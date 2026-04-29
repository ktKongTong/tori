import { bytesToHex } from "../encoding/bytes.ts";

export type RandomCodeOptions = {
  prefix?: string;
  byteLength?: number;
};

export function randomCode(byteLength?: number): string;
export function randomCode(prefix: string, byteLength?: number): string;
export function randomCode(options: RandomCodeOptions): string;
export function randomCode(
  input: string | number | RandomCodeOptions = {},
  byteLength?: number,
): string {
  const options = normalizeRandomCodeOptions(input, byteLength);
  const code = bytesToHex(crypto.getRandomValues(new Uint8Array(options.byteLength)));
  return options.prefix ? `${options.prefix}_${code}` : code;
}

function normalizeRandomCodeOptions(
  input: string | number | RandomCodeOptions,
  byteLength: number | undefined,
): Required<RandomCodeOptions> {
  if (typeof input === "string") {
    return { prefix: input, byteLength: byteLength ?? 16 };
  }
  if (typeof input === "number") {
    return { prefix: "", byteLength: input };
  }
  return { prefix: input.prefix ?? "", byteLength: input.byteLength ?? 16 };
}
