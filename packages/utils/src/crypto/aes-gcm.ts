import { base64ToBytes, bytesToBase64 } from "../encoding/base64.ts";
import { concatBytes, stringToUtf8Bytes, utf8BytesToString } from "../encoding/bytes.ts";

const ALGORITHM = "AES-GCM";
const DEFAULT_IV_LENGTH = 12;
const DEFAULT_TAG_LENGTH = 128;
const DEFAULT_KEY_BYTES = 32;

export type AesGcmOptions = {
  ivLength?: number;
  tagLength?: number;
  keyBytes?: number;
};

async function deriveAesGcmKey(secret: string, options: AesGcmOptions = {}): Promise<CryptoKey> {
  const keyBytes = options.keyBytes ?? DEFAULT_KEY_BYTES;
  const secretBytes = stringToUtf8Bytes(secret.slice(0, keyBytes).padEnd(keyBytes, "0"));
  return crypto.subtle.importKey(
    "raw",
    secretBytes.buffer as ArrayBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptAesGcmToBase64(
  plaintext: string,
  secret: string,
  options: AesGcmOptions = {},
): Promise<string> {
  const key = await deriveAesGcmKey(secret, options);
  const iv = crypto.getRandomValues(new Uint8Array(options.ivLength ?? DEFAULT_IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: options.tagLength ?? DEFAULT_TAG_LENGTH },
    key,
    stringToUtf8Bytes(plaintext).buffer as ArrayBuffer,
  );
  return bytesToBase64(concatBytes(iv, new Uint8Array(ciphertext)));
}

export async function decryptAesGcmFromBase64(
  encrypted: string,
  secret: string,
  options: AesGcmOptions = {},
): Promise<string> {
  const key = await deriveAesGcmKey(secret, options);
  const combined = base64ToBytes(encrypted);
  const ivLength = options.ivLength ?? DEFAULT_IV_LENGTH;
  const iv = combined.slice(0, ivLength);
  const ciphertext = combined.slice(ivLength);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: options.tagLength ?? DEFAULT_TAG_LENGTH },
    key,
    ciphertext.buffer as ArrayBuffer,
  );
  return utf8BytesToString(new Uint8Array(decrypted));
}

export const encrypt = encryptAesGcmToBase64;
export const decrypt = decryptAesGcmFromBase64;
