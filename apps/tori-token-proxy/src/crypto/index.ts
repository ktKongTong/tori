// AES-256-GCM encryption using Web Crypto API (works on all platforms)

const ALGO = "AES-GCM";
const _KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.slice(0, 32).padEnd(32, "0")),
    { name: ALGO },
    false,
    ["encrypt", "decrypt"],
  );
  return keyMaterial;
}

export async function encrypt(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv, tagLength: TAG_LENGTH },
    key,
    encoded,
  );

  // Combine iv + ciphertext → base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encrypted: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
