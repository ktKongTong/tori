import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { parseBoolean } from "../src/common/boolean.ts";
import { diffFields } from "../src/common/diff-field.ts";
import { uniqueId } from "../src/common/id.ts";
import { mergeFields } from "../src/common/merge-field.ts";
import { randomCode } from "../src/common/random.ts";
import {
  base64ToBase64Url,
  base64ToBytes,
  base64UrlToBase64,
  bytesToBase64,
  bytesToBase64Url,
} from "../src/encoding/base64.ts";
import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  stringToUtf8Bytes,
  utf8BytesToString,
} from "../src/encoding/bytes.ts";
import { decryptAesGcmFromBase64, encryptAesGcmToBase64 } from "../src/crypto/aes-gcm.ts";
import { cronSchema } from "../src/schema/cron.ts";
import { dateToIsoDatetime } from "../src/schema/date.ts";
import { errorResponseSchema, rateLimitErrorResponseSchema } from "../src/schema/http.ts";
import { pageCodec } from "../src/schema/paging.ts";
import { safeParseResult } from "../src/schema/result.ts";
import { z } from "zod";
import { randomString, sha256Hash, stringHash } from "../src/encoding/hash.ts";
import { generateName } from "../src/name/generate-name.ts";
import { dataEnvelope, errorEnvelope } from "../src/protocol/envelope.ts";
import { isJsonObject, isJsonValue, type JsonRecord } from "../src/protocol/json.ts";

const randomCharset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";

describe("common utilities", () => {
  it("parses booleans, numbers, strings, and defaults", () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean(0)).toBe(false);
    expect(parseBoolean(" YES ")).toBe(true);
    expect(parseBoolean("DISABLED")).toBe(false);
    expect(parseBoolean("unknown", false)).toBe(false);
  });

  it("detects changed, added, and removed fields", () => {
    expect(
      diffFields<{ a: number; b?: string; c?: number }>(
        { a: 1, b: "old" },
        { a: 1, b: "new", c: 3 },
      ),
    ).toEqual({ b: "new", c: 3 });
    expect(diffFields({ a: 1, b: 2 }, { a: 1 })).toEqual({ b: undefined });
  });

  it("merges patch fields with replace-array default", () => {
    expect(
      mergeFields({ nested: { a: 1, b: 2 }, items: [1, 2] }, { nested: { b: 3 }, items: [3] }),
    ).toEqual({ nested: { a: 1, b: 3 }, items: [3] });
  });

  it("creates UUID v7 identifiers", () => {
    expect(uniqueId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("creates random hex codes with optional prefixes", () => {
    expect(randomCode(4)).toMatch(/^[0-9a-f]{8}$/);
    expect(randomCode("dc", 4)).toMatch(/^dc_[0-9a-f]{8}$/);
    expect(randomCode({ prefix: "ac", byteLength: 4 })).toMatch(/^ac_[0-9a-f]{8}$/);
  });
});

describe("encoding utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips utf8, hex, and base64 values", () => {
    const bytes = stringToUtf8Bytes("hello 世界");
    expect(utf8BytesToString(bytes)).toBe("hello 世界");
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("converts base64url values", () => {
    const bytes = new Uint8Array([251, 255, 255]);
    const url = bytesToBase64Url(bytes);
    expect(url).not.toContain("+");
    expect(url).not.toContain("/");
    expect(base64ToBase64Url(base64UrlToBase64(url))).toBe(url);
  });

  it("concatenates bytes", () => {
    expect(concatBytes(new Uint8Array([1]), new Uint8Array([2, 3]))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("creates deterministic string hashes", () => {
    const text = "/comment/admin-sdis-12323/reply?docId=3203";
    expect(stringHash(text)).toBe(stringHash(text));
    expect(stringHash(text)).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("creates random strings with expected length and charset", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    const result = randomString(20);
    expect(result).toHaveLength(20);
    expect(Array.from(result).every((character) => randomCharset.includes(character))).toBe(true);
  });

  it("creates SHA-256 hashes", async () => {
    await expect(sha256Hash("hello")).resolves.toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("schema utilities", () => {
  it("encodes and decodes ISO datetimes", () => {
    const date = new Date("2024-01-01T12:00:00.000Z");
    expect(dateToIsoDatetime.encode(date)).toBe("2024-01-01T12:00:00.000Z");
    expect(dateToIsoDatetime.decode("2024-01-01T12:00:00.000Z")).toBeInstanceOf(Date);
  });

  it("validates cron expressions", () => {
    expect(cronSchema.parse(" *  *   * * * ")).toBe("* * * * *");
    expect(cronSchema.safeParse("60 * * * *").success).toBe(false);
  });

  it("round-trips page params through encoded cursor", () => {
    const source = { page: 7, pageSize: 33 };
    expect(pageCodec.encode(pageCodec.decode(source))).toEqual(source);
    expect(pageCodec.encode({})).toEqual({ page: 1, pageSize: 100 });
  });

  it("bridges zod safeParse into better-result", () => {
    const schema = z.object({ id: z.string() });
    expect(safeParseResult(schema, { id: "ok" }).unwrap()).toEqual({ id: "ok" });
    expect(safeParseResult(schema, { id: 1 }).isErr()).toBe(true);
  });

  it("validates shared HTTP schemas", () => {
    expect(errorResponseSchema.parse({ code: "BAD_REQUEST", message: "Bad request" })).toEqual({
      code: "BAD_REQUEST",
      message: "Bad request",
    });
    expect(
      rateLimitErrorResponseSchema.safeParse({
        code: "RATE_LIMITED",
        message: "Rate limited",
        detail: { retryAfter: 60 },
      }).success,
    ).toBe(true);
  });
});

describe("crypto utilities", () => {
  it("encrypts and decrypts AES-GCM base64 payloads", async () => {
    const secret = "a-secret-that-is-long-enough-for-tests";
    const encrypted = await encryptAesGcmToBase64("payload", secret);
    expect(encrypted).not.toBe("payload");
    await expect(decryptAesGcmFromBase64(encrypted, secret)).resolves.toBe("payload");
  });
});

describe("name utilities", () => {
  it("generates deterministic names when Math.random is controlled", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const name = generateName();
    expect(name).toContain("-");
    expect(name.split("-")).toHaveLength(2);
    randomSpy.mockRestore();
  });
});

describe("protocol utilities", () => {
  it("types json records and detects json objects", () => {
    const value: JsonRecord = { ok: true, nested: { count: 1 } };
    expect(isJsonObject(value)).toBe(true);
    expect(isJsonValue(value)).toBe(true);
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject([])).toBe(false);
    expect(isJsonValue({ bad: () => undefined })).toBe(false);
  });

  it("creates response envelopes", () => {
    expect(dataEnvelope({ id: "1" })).toEqual({ data: { id: "1" } });
    expect(errorEnvelope("BAD_REQUEST", "Bad request")).toEqual({
      error: { code: "BAD_REQUEST", message: "Bad request" },
    });
    expect(errorEnvelope("BAD_REQUEST", "Bad request", { traceId: "trace-1" })).toEqual({
      error: { code: "BAD_REQUEST", message: "Bad request", traceId: "trace-1" },
    });
  });
});
