export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function base64ToBase64Url(value: string): string {
  return value.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function base64UrlToBase64(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return base64ToBase64Url(bytesToBase64(bytes));
}

export function base64UrlToBytes(value: string): Uint8Array {
  return base64ToBytes(base64UrlToBase64(value));
}
