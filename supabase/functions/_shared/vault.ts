// Encrypts the site logins users hand us for auto-apply. Only edge functions
// hold the key (CREDENTIALS_KEY), so a database leak exposes ciphertext only.
// Uses WebCrypto, which both Deno and Node 22 provide.

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

// The secret can be any long random string; it is hashed down to an AES-256 key.
async function keyFrom(secret: string) {
  if (secret.length < 32) throw new Error('CREDENTIALS_KEY must be at least 32 characters.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Returns base64 of a fresh 12-byte nonce followed by the AES-GCM ciphertext. */
export async function encryptSecret(plain: string, secret: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, await keyFrom(secret), new TextEncoder().encode(plain));
  const out = new Uint8Array(12 + sealed.byteLength);
  out.set(nonce);
  out.set(new Uint8Array(sealed), 12);
  return toBase64(out);
}

/** Throws when the key is wrong or the stored value was altered. */
export async function decryptSecret(stored: string, secret: string): Promise<string> {
  const bytes = fromBase64(stored);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await keyFrom(secret), bytes.slice(12));
  return new TextDecoder().decode(plain);
}

/** The key a saved login is filed under: the hostname of the job's link. */
export function siteOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}
