import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { S3Client } from "../src/s3.ts";

const { signMock } = vi.hoisted(() => ({
  signMock: vi.fn(),
}));

vi.mock("aws4fetch", () => ({
  AwsClient: class {
    sign = signMock;
  },
}));

describe("S3Client", () => {
  let s3Client: S3Client;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    s3Client = new S3Client({
      S3_ACCESS_KEY_ID: "ak",
      S3_SECRET_ACCESS_KEY: "sk",
      S3_ENDPOINT: "http://127.0.0.1:9000",
      S3_BUCKET: "public-bucket",
      S3_REGION: "auto",
      S3_PUBLIC_DOMAIN: "http://cdn.local",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds presigned upload url", async () => {
    signMock.mockResolvedValueOnce({
      url: "http://127.0.0.1:9000/public-bucket/a.txt?X-Amz-Expires=120",
    });

    const url = await s3Client.getPresignedUploadUrl("a.txt", "text/plain", 120);

    expect(url).toContain("X-Amz-Expires=120");
    expect(signMock).toHaveBeenCalledWith(expect.stringContaining("/public-bucket/a.txt"), {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      aws: { signQuery: true },
    });
  });

  it("returns null when headObject sees 404", async () => {
    signMock.mockResolvedValueOnce("http://signed-url/head");
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 404 }));

    await expect(s3Client.headObject("missing.txt")).resolves.toBeNull();
  });

  it("parses headObject metadata when object exists", async () => {
    signMock.mockResolvedValueOnce("http://signed-url/head");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: {
          "content-length": "11",
          etag: '"etag-123"',
          "last-modified": "Fri, 20 Mar 2026 13:40:00 GMT",
        },
      }),
    );

    const metadata = await s3Client.headObject("exists.txt");

    expect(metadata).toEqual({
      size: 11,
      etag: "etag-123",
      lastModified: new Date("Fri, 20 Mar 2026 13:40:00 GMT"),
    });
  });

  it("throws when putObject gets non-2xx response", async () => {
    signMock.mockResolvedValueOnce({
      url: "http://signed-url/put",
      headers: { Authorization: "AWS4-HMAC-SHA256 ..." },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("denied", { status: 403, statusText: "Forbidden" }),
    );

    await expect(s3Client.putObject("deny.txt", "body", "text/plain")).rejects.toThrow(
      "S3 PUT failed: Forbidden",
    );
  });

  it("returns key and normalized etag when putObject succeeds", async () => {
    signMock.mockResolvedValueOnce({
      url: "http://signed-url/put",
      headers: { Authorization: "AWS4-HMAC-SHA256 ..." },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: { etag: '"etag-ok"' },
      }),
    );

    const result = await s3Client.putObject("ok.txt", "content", "text/plain");

    expect(result).toEqual({ key: "ok.txt", etag: "etag-ok" });
  });

  it("throws missing configuration error", () => {
    expect(
      () =>
        new S3Client({
          S3_ACCESS_KEY_ID: "",
          S3_SECRET_ACCESS_KEY: "",
          S3_ENDPOINT: "",
          S3_BUCKET: "",
        }),
    ).toThrow("S3 configuration is missing");
  });

  it("prefers public domain when building public url", () => {
    expect(s3Client.getPublicUrl("a/b.txt")).toBe("http://cdn.local/a/b.txt");
  });
});
