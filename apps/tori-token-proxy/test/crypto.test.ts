import { describe, expect, it } from "vite-plus/test";
import { decrypt, encrypt } from "../src/crypto/index.ts";

describe("crypto", () => {
  const secret = "a]3kF9!zQ7vL@mW#nX2pR8sT5uY0bD4e";

  it("should encrypt and decrypt a string", async () => {
    const plain = "hello-world-token-123";
    const encrypted = await encrypt(plain, secret);
    expect(encrypted).not.toBe(plain);
    const decrypted = await decrypt(encrypted, secret);
    expect(decrypted).toBe(plain);
  });

  it("should produce different ciphertexts for same plaintext (random IV)", async () => {
    const plain = "same-input";
    const a = await encrypt(plain, secret);
    const b = await encrypt(plain, secret);
    expect(a).not.toBe(b);
    expect(await decrypt(a, secret)).toBe(plain);
    expect(await decrypt(b, secret)).toBe(plain);
  });

  it("should fail to decrypt with wrong secret", async () => {
    const encrypted = await encrypt("secret-data", secret);
    await expect(decrypt(encrypted, "wrong-secret-that-is-32-chars!!!")).rejects.toThrow();
  });

  it("should handle empty string", async () => {
    const encrypted = await encrypt("", secret);
    const decrypted = await decrypt(encrypted, secret);
    expect(decrypted).toBe("");
  });

  it("should handle long strings", async () => {
    const long = "x".repeat(10000);
    const encrypted = await encrypt(long, secret);
    const decrypted = await decrypt(encrypted, secret);
    expect(decrypted).toBe(long);
  });
});
