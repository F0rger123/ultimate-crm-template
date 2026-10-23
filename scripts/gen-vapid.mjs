// Generates a Web Push (VAPID) P-256 key pair in the base64url format the app expects.
// Usage: npm run gen:vapid
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);

console.log("VITE_VAPID_PUBLIC_KEY=" + b64u(raw));
console.log("VAPID_PUBLIC_KEY=" + b64u(raw));
console.log("VAPID_PRIVATE_KEY=" + priv.d);
console.log("\nPut VITE_VAPID_PUBLIC_KEY in .env (and Cloudflare build env); VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in Cloudflare secrets. Never commit the private key.");
