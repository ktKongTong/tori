import { Buffer } from "node:buffer";
import process from "node:process";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import { S3Client, type S3ClientConfig } from "../src/s3.ts";

const createKey = (name: string) =>
  `itest/${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;

let s3Client: S3Client;
const integrationConfig = {
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION,
  S3_PUBLIC_DOMAIN: process.env.S3_PUBLIC_DOMAIN,
} satisfies S3ClientConfig;
const hasS3IntegrationEnv = Boolean(
  integrationConfig.S3_ACCESS_KEY_ID &&
  integrationConfig.S3_SECRET_ACCESS_KEY &&
  integrationConfig.S3_ENDPOINT &&
  integrationConfig.S3_BUCKET &&
  integrationConfig.S3_REGION &&
  integrationConfig.S3_PUBLIC_DOMAIN,
);

describe.skipIf(!hasS3IntegrationEnv)("S3Client integration", () => {
  beforeAll(async () => {
    s3Client = new S3Client(integrationConfig);
    const health = await fetch(`${integrationConfig.S3_ENDPOINT}/health`);
    if (!health.ok) {
      throw new Error(`S3 health check failed: ${health.status} ${health.statusText}`);
    }
  });

  it("uploads object by signed PUT and reads metadata by HEAD", async () => {
    const key = createKey("put-object");
    const body = "s3 integration put object";

    const uploaded = await s3Client.putObject(key, body, "text/plain");
    expect(uploaded.key).toBe(key);
    expect(uploaded.etag).toBeTruthy();

    const metadata = await s3Client.headObject(key);
    expect(metadata).not.toBeNull();
    expect(metadata?.size).toBe(Buffer.byteLength(body));
    expect(metadata?.etag).toBeTruthy();
  });

  it("supports presigned upload url flow", async () => {
    const key = createKey("presigned");
    const body = "s3 presigned upload";

    const signedUrl = await s3Client.getPresignedUploadUrl(key, "text/plain", 300);
    expect(signedUrl).toContain("X-Amz-Expires=300");

    const putRes = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    expect(putRes.ok).toBe(true);

    const metadata = await s3Client.headObject(key);
    expect(metadata?.size).toBe(Buffer.byteLength(body));
  });

  it("returns null for missing object on HEAD", async () => {
    const key = createKey("missing");
    const metadata = await s3Client.headObject(key);
    expect(metadata).toBeNull();
  });

  it("builds public url from configured domain", () => {
    const key = createKey("public-url");
    const url = s3Client.getPublicUrl(key);
    expect(url).toBe(`${integrationConfig.S3_PUBLIC_DOMAIN}/${key}`);
  });
});
