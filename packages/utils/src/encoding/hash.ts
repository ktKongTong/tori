const CONVERSION_TABLE = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RANDOM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";

function bitwise(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash &= hash;
  }
  return hash;
}

function binaryTransfer(integer: number, binary = 62): string {
  if (binary < 2 || binary > CONVERSION_TABLE.length) {
    throw new Error(`binary should between 2 and ${CONVERSION_TABLE.length}`);
  }

  if (integer === 0) return CONVERSION_TABLE[0] ?? "0";

  const stack: string[] = [];
  const sign = integer < 0 ? "-" : "";
  let number = Math.abs(integer);

  while (number > 0) {
    stack.push(CONVERSION_TABLE[number % binary] ?? "0");
    number = Math.floor(number / binary);
  }

  return sign + stack.reverse().join("");
}

export function stringHash(text: string): string {
  return binaryTransfer(bitwise(text), 61).replace("-", "Z");
}

export function randomString(length = 8): string {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const position = Math.floor(Math.random() * RANDOM_CHARS.length);
    result += RANDOM_CHARS.charAt(position);
  }
  return result;
}

export async function sha256Hash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
