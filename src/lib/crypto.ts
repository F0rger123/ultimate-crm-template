// Lightweight reversible obfuscation for secrets at rest in localStorage.
// This is NOT real encryption — there's no separate key, so anyone with access to
// the browser's localStorage can reverse it. It only prevents the value from
// sitting around in plain text. A real secret (like a Stripe secret key) belongs
// behind a backend; this exists because the app currently has none.
const SALT = "crm-starter-v1";

export const obfuscate = (text: string): string => {
  if (!text) return "";
  const xored = text.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ SALT.charCodeAt(i % SALT.length))).join("");
  return btoa(unescape(encodeURIComponent(xored)));
};

export const deobfuscate = (encoded: string): string => {
  if (!encoded) return "";
  try {
    const xored = decodeURIComponent(escape(atob(encoded)));
    return xored.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ SALT.charCodeAt(i % SALT.length))).join("");
  } catch {
    return "";
  }
};
