import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { isMatch } from "matcher";
import { getTrustedOrigins } from "@/api/support/auth";

/**
 * CORS middleware that reuses `BETTER_AUTH_TRUSTED_ORIGIN` for origin validation.
 * Must be placed AFTER envMiddleware (which calls setGlobalEnv).
 */
export const corsMiddleware = () =>
  createMiddleware(async (c, next) => {
    const env = c.get("appEnv");
    const handler = cors({
      origin: (origin) => {
        const trusted = getTrustedOrigins(env);
        if (trusted.some((t) => isMatch(origin, t))) return origin;
        return null;
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "Idempotency-Key",
        "X-Api-Key",
        "X-Correlation-ID",
      ],
      credentials: true,
      maxAge: 86400,
    });
    return handler(c, next);
  });
