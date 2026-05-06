import { isMatch } from "matcher";
import { z } from "zod";
import type { ENV } from "@/api/domain/infra/env";

export const inferOriginURL = (request: Request | undefined) => {
  const headerOrigin = request?.headers?.get("origin");
  const headerHost = request?.headers?.get("x-forwarded-host");
  let headerProto = request?.headers?.get("x-forwarded-proto");

  if (headerOrigin) {
    const host = new URL(headerOrigin);
    return host.origin;
  }

  if (headerHost && headerProto) {
    if (headerHost.match(/^localhost:\d{3,5}$/)) {
      headerProto = "http";
    }
    const host = new URL(`${headerProto}://${headerHost}`);
    return host.origin;
  }

  return undefined;
};

export const getTrustedOriginPattern = (trust: string = "") => {
  return trust
    .split(",")
    .map((item) => item.trim())
    .filter((item) => z.url().safeParse(item).success);
};

export const verifyIfTrustedOrigin = (origin: string, env: ENV) => {
  if (!z.url().safeParse(origin).success) return false;
  const patterns = getTrustedOriginPattern(env.BETTER_AUTH_TRUSTED_ORIGIN);
  return isMatch(origin, patterns);
};

export const resolveAuthBaseURL = (request: Request | undefined, env: ENV) => {
  const origin = inferOriginURL(request);
  if (!origin || !verifyIfTrustedOrigin(origin, env)) return undefined;
  return `${origin}/api/auth`;
};
