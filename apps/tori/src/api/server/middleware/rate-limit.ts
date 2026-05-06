import { createMiddleware } from "hono/factory";
import { RateLimitError } from "@/api/domain/error";
import type { IKV } from "@/api/domain/infra";

export type RateLimitConfig = {
  /** Window duration in seconds */
  windowSec: number;
  /** Max requests allowed within the window */
  maxRequests: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

async function checkRateLimit(
  kv: IKV,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % config.windowSec);
  const resetAt = windowStart + config.windowSec;

  const windowKey = `${key}:${windowStart}`;
  const current = await kv.incr(windowKey, 1, config.windowSec + 10);
  // TTL = windowSec + 10s buffer to ensure key is available for the entire window

  const allowed = current <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - current);

  return { allowed, remaining, resetAt };
}

/**
 * Rate limiting middleware using fixed-window counter over KV.
 *
 * @param category - Rate limit category name (e.g. 'read', 'write', 'admin')
 * @param anonConfig - Config for anonymous users
 * @param authedConfig - Config for authenticated users (optional, defaults to anonConfig)
 */
export const rateLimitMiddleware = (
  category: string,
  anonConfig: RateLimitConfig,
  authedConfig?: RateLimitConfig,
) =>
  createMiddleware(async (c, next) => {
    const user = c.get("user");
    const ip =
      c.req.header("CF-Connecting-IP") ??
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "unknown";
    const identifier = user ? `user:${user.id}` : ip;
    const key = `rl:${category}:${identifier}`;
    const config = user && authedConfig ? authedConfig : anonConfig;

    const kv: IKV = c.get("kv");
    const result = await checkRateLimit(kv, key, config);

    c.header("X-RateLimit-Limit", String(config.maxRequests));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(result.resetAt));

    if (!result.allowed) {
      throw new RateLimitError(result.resetAt - Math.floor(Date.now() / 1000));
    }

    await next();
  });
