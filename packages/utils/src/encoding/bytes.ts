export function stringToUtf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function utf8BytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function concatBytes(...items: Uint8Array[]): Uint8Array {
  const length = items.reduce((total, item) => total + item.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const item of items) {
    output.set(item, offset);
    offset += item.length;
  }
  return output;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string length must be even");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const value = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (Number.isNaN(value)) {
      throw new Error("Invalid hex string");
    }
    bytes[index] = value;
  }
  return bytes;
}
