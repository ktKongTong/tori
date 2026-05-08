import { createMiddleware } from "hono/factory";
import { StatusConflictError } from "@/api/domain/error";
import { stringHash } from "@repo/utils/encoding/hash";

type CachedResponse = {
  status: number;
  body: unknown;
};

type IdempotencyMeta = {
  fingerprint: string;
};

const IDEMPOTENCY_TTL_SEC = 24 * 60 * 60;

export const checkIdempotencyKey = createMiddleware(async (c, next) => {
  const idempotencyKey = c.req.header("Idempotency-Key");
  if (idempotencyKey == null || (c.req.method !== "POST" && c.req.method !== "PATCH"))
    return next();
  const kv = c.get("kv");
  const requestBody = await c.req.raw.clone().text();
  const fingerprint = stringHash(`${c.req.method}:${c.req.path}:${requestBody}`);
  const scope = `${c.req.method}:${c.req.path}`;
  const metaKey = `idempotency:meta:${idempotencyKey}:${scope}`;
  const responseKey = `idempotency:${idempotencyKey}:${fingerprint}`;
  const meta = await kv.get<IdempotencyMeta>(metaKey);
  if (meta != null && meta.fingerprint !== fingerprint) {
    throw new StatusConflictError("Idempotency key already used with different payload");
  }
  const cached = await kv.get<CachedResponse>(responseKey);
  if (cached) {
    return c.json(cached.body, cached.status as 200);
  }
  await next();
  const contentType = c.res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return;
  if (c.res.status >= 500) return;
  const response = c.res.clone();
  const json = await response.json();
  await Promise.all([
    kv.set(metaKey, { fingerprint }, IDEMPOTENCY_TTL_SEC),
    kv.set(responseKey, { status: c.res.status, body: json }, IDEMPOTENCY_TTL_SEC),
  ]);
});
