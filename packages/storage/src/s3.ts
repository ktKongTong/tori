import { AwsClient } from "aws4fetch";

export type S3ClientConfig = {
  S3_ACCESS_KEY_ID?: string | null;
  S3_SECRET_ACCESS_KEY?: string | null;
  S3_ENDPOINT?: string | null;
  S3_BUCKET?: string | null;
  S3_REGION?: string | null;
  S3_PUBLIC_DOMAIN?: string | null;
};

export type S3ObjectMetadata = {
  size: number;
  etag: string;
  lastModified: Date;
};

export type S3PutObjectResult = {
  key: string;
  etag: string;
};

export class S3Client {
  readonly awsClient: AwsClient;
  readonly baseURL: string;

  constructor(private config: S3ClientConfig) {
    const endpoint = requireConfig(config.S3_ENDPOINT);
    const bucket = requireConfig(config.S3_BUCKET);

    this.awsClient = createAwsClient(config);
    this.baseURL = `${endpoint}/${bucket}`;
  }

  async headObject(key: string): Promise<S3ObjectMetadata | null> {
    const url = `${this.baseURL}/${key}`;
    const signed = await this.awsClient.sign(url, {
      method: "HEAD",
      aws: {
        signQuery: true,
      },
    });

    const response = await fetch(signed);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`S3 HEAD failed: ${response.statusText}`);

    const contentLength = response.headers.get("content-length");
    const etag = response.headers.get("etag");
    const lastModified = response.headers.get("last-modified");

    return {
      size: contentLength ? parseInt(contentLength, 10) : 0,
      etag: etag ? etag.replace(/"/g, "") : "",
      lastModified: lastModified ? new Date(lastModified) : new Date(),
    };
  }

  async putObject(key: string, body: string, contentType: string): Promise<S3PutObjectResult> {
    const url = `${this.baseURL}/${key}`;
    const signed = await this.awsClient.sign(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
    });

    const response = await fetch(signed.url, {
      method: "PUT",
      headers: signed.headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`S3 PUT failed: ${response.statusText}`);
    }

    return {
      key,
      etag: response.headers.get("etag")?.replace(/"/g, "") || "",
    };
  }

  getPublicUrl(key: string) {
    if (this.config.S3_PUBLIC_DOMAIN) return `${this.config.S3_PUBLIC_DOMAIN}/${key}`;
    return `${requireConfig(this.config.S3_ENDPOINT)}/${requireConfig(this.config.S3_BUCKET)}/${key}`;
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const url = new URL(`${this.baseURL}/${key}`);
    url.searchParams.set("X-Amz-Expires", expiresIn.toString());
    const signed = await this.awsClient.sign(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      aws: {
        signQuery: true,
      },
    });
    return signed.url;
  }
}

function createAwsClient(config: S3ClientConfig) {
  return new AwsClient({
    accessKeyId: requireConfig(config.S3_ACCESS_KEY_ID),
    secretAccessKey: requireConfig(config.S3_SECRET_ACCESS_KEY),
    service: "s3",
    region: config.S3_REGION || "auto",
  });
}

function requireConfig(value: string | null | undefined): string {
  if (!value) {
    throw new Error("S3 configuration is missing");
  }
  return value;
}
