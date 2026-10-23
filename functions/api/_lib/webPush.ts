// Web Push, implemented from the actual RFCs against Cloudflare Workers'
// native Web Crypto API (no npm "web-push" package — that's a Node library
// built on Node's `crypto` module, which doesn't exist in the Workers edge
// runtime; the standard SubtleCrypto API this file uses is what Workers
// actually supports). Two RFCs, both implemented exactly to spec:
//   - RFC 8291 (Message Encryption for Web Push) — the aes128gcm content
//     coding, ECDH key agreement between this server's per-message ephemeral
//     key and the subscriber's p256dh key, HKDF key derivation.
//   - RFC 8292 (VAPID) — an ES256-signed JWT identifying this server to the
//     push service, so it doesn't need per-service API keys (works
//     identically against Chrome/FCM, Firefox, and Apple's push service for
//     an installed iOS 16.4+ PWA — VAPID is the whole point of not needing
//     three different vendor SDKs).
// One detail worth flagging: SubtleCrypto's ECDSA signatures are already in
// raw (r||s) format per the WebCrypto spec — no DER-to-raw conversion step
// needed here, unlike Node's crypto.sign() which defaults to DER.

const b64urlEncode = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlDecode = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const concatBytes = (...arrs: Uint8Array[]): Uint8Array => {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
};
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

// HKDF per RFC 5869, built from raw HMAC-SHA256 primitives (SubtleCrypto has
// an "HKDF" algorithm, but it can't be used here because RFC 8291 needs the
// intermediate PRK exposed to derive CEK/NONCE from — the standard
// deriveBits("HKDF") call collapses extract+expand into one opaque step).
const hmacSha256 = async (keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(sig);
};
const hkdfExtract = (salt: Uint8Array, ikm: Uint8Array) => hmacSha256(salt, ikm);
const hkdfExpand = async (prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> => {
  // Only ever called here with length <= 32 (one HMAC-SHA256 block), so a
  // single T(1) = HMAC(PRK, info || 0x01) covers every use in this file —
  // no need for the general multi-block expand loop.
  const t1 = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return t1.slice(0, length);
};

export interface PushSubscriptionKeys { endpoint: string; p256dh: string; auth: string }

// RFC 8291 §3.4 encryption, producing an aes128gcm-encoded body (RFC 8188).
const encryptPayload = async (
  subscription: PushSubscriptionKeys,
  payloadBytes: Uint8Array
): Promise<{ body: Uint8Array; asPublicRaw: Uint8Array }> => {
  const uaPublicRaw = b64urlDecode(subscription.p256dh); // 65-byte uncompressed EC point
  const authSecret = b64urlDecode(subscription.auth); // 16 bytes

  // Import the subscriber's public key, generate our own ephemeral P-256
  // pair for this one message (a fresh key per message is required by the
  // spec — never reuse an application-server ephemeral key across pushes).
  const uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256));

  const prkKey = await hkdfExtract(authSecret, ecdhSecret);
  const keyInfo = concatBytes(utf8("WebPush: info\0"), uaPublicRaw, asPublicRaw);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cekBytes = await hkdfExpand(prk, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, utf8("Content-Encoding: nonce\0"), 12);

  const cek = await crypto.subtle.importKey("raw", cekBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  // Single-record message: append the 0x02 "last record" delimiter (RFC
  // 8188 §2) — every web push payload fits in one record (max ~4KB, well
  // under any push service's payload size limit).
  const plaintext = concatBytes(payloadBytes, new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cek, plaintext));

  // RFC 8188 header: salt(16) || record_size(4, big-endian) || idlen(1) || keyid(idlen)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, rs, new Uint8Array([asPublicRaw.length]), asPublicRaw);
  return { body: concatBytes(header, ciphertext), asPublicRaw };
};

// RFC 8292 VAPID JWT — identifies this server to the push service (FCM,
// Mozilla's autopush, or Apple's push service for an installed PWA) without
// needing separate per-vendor credentials.
const signVapidJwt = async (audience: string, subjectMailto: string, vapidPrivateKeyB64url: string): Promise<string> => {
  const header = { typ: "JWT", alg: "ES256" };
  const claims = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subjectMailto };
  const encHeader = b64urlEncode(utf8(JSON.stringify(header)));
  const encClaims = b64urlEncode(utf8(JSON.stringify(claims)));
  const signingInput = `${encHeader}.${encClaims}`;

  const dBytes = b64urlDecode(vapidPrivateKeyB64url); // raw 32-byte EC private scalar
  // Import as a JWK — SubtleCrypto has no "import raw EC private scalar"
  // path, but a P-256 JWK only needs d (private) — x/y (public) aren't
  // required for a sign-only key per the JWK EC spec, and Workers' WebCrypto
  // accepts that.
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: vapidPrivateKeyB64url, ext: true, key_ops: ["sign"] } as JsonWebKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, utf8(signingInput));
  // WebCrypto ECDSA signatures are raw r||s (64 bytes for P-256) — exactly
  // the JWS ES256 signature format, no DER conversion needed.
  return `${signingInput}.${b64urlEncode(sig)}`;
};

export interface SendWebPushResult { ok: boolean; status: number; error?: string; gone?: boolean }

// Sends one push message. `gone: true` means the push service reported the
// subscription is dead (410 Gone / 404 Not Found — e.g. the user uninstalled
// the app or the OS expired the subscription) — the caller should delete
// that subscription row rather than keep retrying it forever.
export const sendWebPush = async (
  subscription: PushSubscriptionKeys,
  payload: { title: string; body: string; url?: string; tag?: string },
  vapidPublicKeyB64url: string,
  vapidPrivateKeyB64url: string,
  vapidSubjectMailto: string
): Promise<SendWebPushResult> => {
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const [jwt, { body }] = await Promise.all([
      signVapidJwt(audience, vapidSubjectMailto, vapidPrivateKeyB64url),
      encryptPayload(subscription, utf8(JSON.stringify(payload))),
    ]);
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKeyB64url}`,
      },
      body,
    });
    if (res.status === 201 || res.status === 200) return { ok: true, status: res.status };
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 200), gone: res.status === 404 || res.status === 410 };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || "Push send failed" };
  }
};
