export type ObjectBody = string | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>;

export type ObjectMetadata = Record<string, string>;

export type PutObjectInput = {
  key: string;
  body: ObjectBody;
  contentType?: string;
  metadata?: ObjectMetadata;
};

export type GetObjectResult = {
  key: string;
  body: ReadableStream<Uint8Array> | null;
  contentType?: string;
  metadata?: ObjectMetadata;
};

export type ListObjectsInput = {
  prefix?: string;
  cursor?: string;
  limit?: number;
};

export type ListedObject = {
  key: string;
  size?: number;
  updatedAt?: Date;
};

export type ListObjectsResult = {
  objects: ListedObject[];
  nextCursor?: string;
};

export type ObjectStore = {
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<GetObjectResult | undefined>;
  delete(key: string): Promise<void>;
  list(input?: ListObjectsInput): Promise<ListObjectsResult>;
};

export function joinObjectKey(...parts: Array<string | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}
