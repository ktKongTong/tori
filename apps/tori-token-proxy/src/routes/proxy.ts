import { Hono } from "hono";
import { decrypt } from "../crypto/index.ts";
import type { Repository } from "../repository/types.ts";
import type { Connection } from "../types.ts";

interface ProxyDeps {
  repo: Repository;
  secret: string;
}

const SENSITIVE_LOG_KEYS = new Set([
  "authorization",
  "set-cookie",
  "cookie",
  "x-api-key",
  "access_token",
  "acceess_token",
  "token",
  "refresh_token",
]);

export function proxyRoutes(deps: ProxyDeps) {
  const { repo, secret } = deps;
  const app = new Hono();

  // ─── ALL /proxy/:provider/* ───
  // Transparent proxy: method + body pass through as-is
  // Target URL via X-PROXY-URL header
  app.all("/:provider{.+}", async (c) => {
    const conn = c.get("connection") as Connection;
    const provider = c.req.param("provider");
    const capturedHeaders = captureRequestHeaders(c.req.raw.headers);
    const requestBody = await captureRequestBody(c.req.raw);

    // Verify connection matches provider
    if (conn.provider !== provider) {
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        targetUrl: captureTargetUrl(c.req.header("X-PROXY-URL")),
        headers: capturedHeaders,
        statusCode: 403,
        error: `provider mismatch: ${conn.provider} != ${provider}`,
        createdAt: Math.floor(Date.now() / 1000),
      });
      return c.json(
        {
          error: "forbidden",
          error_description: `API key is for provider "${conn.provider}", not "${provider}"`,
        },
        403,
      );
    }

    // Target URL from header
    const targetUrl = c.req.header("X-PROXY-URL");
    if (!targetUrl) {
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        headers: capturedHeaders,
        statusCode: 400,
        error: "missing X-PROXY-URL header",
        createdAt: Math.floor(Date.now() / 1000),
      });
      return c.json(
        {
          error: "invalid_request",
          error_description: "X-PROXY-URL header is required",
        },
        400,
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        targetUrl: captureTargetUrl(targetUrl),
        headers: capturedHeaders,
        statusCode: 400,
        error: "invalid X-PROXY-URL",
        createdAt: Math.floor(Date.now() / 1000),
      });
      return c.json(
        {
          error: "invalid_request",
          error_description: "X-PROXY-URL is not a valid URL",
        },
        400,
      );
    }

    // Check proxy rules
    const rules = await repo.getProxyRules(provider);
    if (rules.length > 0 && !isAllowed(rules, c.req.method, parsedUrl)) {
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        targetUrl: captureTargetUrl(parsedUrl),
        headers: capturedHeaders,
        query: captureQuery(parsedUrl),
        requestBody,
        statusCode: 403,
        error: "blocked by proxy rules",
        createdAt: Math.floor(Date.now() / 1000),
      });
      return c.json(
        {
          error: "forbidden",
          error_description: `${c.req.method} ${parsedUrl.hostname}${parsedUrl.pathname} not allowed by proxy rules`,
        },
        403,
      );
    }

    // Decrypt credentials
    const creds = await repo.getCredentials(conn.id);
    if (!creds) {
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        targetUrl: captureTargetUrl(parsedUrl),
        headers: capturedHeaders,
        query: captureQuery(parsedUrl),
        requestBody,
        statusCode: 500,
        error: "credentials not found",
        createdAt: Math.floor(Date.now() / 1000),
      });
      return c.json(
        {
          error: "server_error",
          error_description: "credentials not found",
        },
        500,
      );
    }
    const accessToken = await decrypt(creds.accessToken, secret);

    // Inject token into target request
    const headers = new Headers();

    // Forward select headers from client
    const forwardHeaders = [
      "content-type",
      "accept",
      "accept-language",
      "origin",
      "referer",
      "user-agent",
    ];
    for (const name of forwardHeaders) {
      const val = c.req.header(name);
      if (val) headers.set(name, val);
    }

    // Token injection
    let finalUrl = targetUrl;
    switch (true) {
      case !conn.tokenInject || conn.tokenInject === "bearer":
        headers.set("Authorization", `Bearer ${accessToken}`);
        break;
      case conn.tokenInject.startsWith("header:"): {
        const headerName = conn.tokenInject.slice(7);
        headers.set(headerName, accessToken);
        break;
      }
      case conn.tokenInject.startsWith("query:"): {
        const paramName = conn.tokenInject.slice(6);
        parsedUrl.searchParams.set(paramName, accessToken);
        finalUrl = parsedUrl.toString();
        break;
      }
      default:
        return c.json(
          {
            error: "server_error",
            error_description: `unsupported token injection: ${conn.tokenInject}`,
          },
          500,
        );
    }

    // Forward body for non-GET requests
    let body: BodyInit | undefined;
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      body = await c.req.raw.clone().arrayBuffer();
      if ((body as ArrayBuffer).byteLength === 0) body = undefined;
    }

    // Execute upstream request
    let resp: Response;
    try {
      resp = await fetch(finalUrl, {
        method: c.req.method,
        headers,
        body,
      });
    } catch (err: any) {
      const loggedUrl = redactInjectedCredentialUrl(finalUrl, conn);
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        targetUrl: captureTargetUrl(loggedUrl),
        headers: capturedHeaders,
        query: captureQuery(loggedUrl),
        requestBody,
        statusCode: 502,
        error: err.message,
        createdAt: Math.floor(Date.now() / 1000),
      });
      return c.json(
        {
          error: "upstream_error",
          error_description: err.message,
        },
        502,
      );
    }

    // Raw passthrough: status + headers + body
    const respHeaders = new Headers();
    resp.headers.forEach((v, k) => {
      const skip = ["transfer-encoding", "connection", "keep-alive"];
      if (!skip.includes(k.toLowerCase())) {
        respHeaders.set(k, v);
      }
    });

    await repo.updateConnection(conn.id, {
      lastUsedAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });
    const loggedUrl = redactInjectedCredentialUrl(finalUrl, conn);
    await repo.createRequestLog({
      connectionId: conn.id,
      routeGroup: "proxy",
      method: c.req.method,
      targetUrl: captureTargetUrl(loggedUrl),
      headers: capturedHeaders,
      query: captureQuery(loggedUrl),
      requestBody,
      statusCode: resp.status,
      createdAt: Math.floor(Date.now() / 1000),
    });

    return new Response(resp.body, {
      status: resp.status,
      headers: respHeaders,
    });
  });

  return app;
}

function captureRequestHeaders(headers: Headers) {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = redactLogValue(key, value) as string;
  });
  return result;
}

function captureQuery(url: URL) {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const safeValue = redactLogValue(key, value) as string;
    const existing = query[key];
    if (existing === undefined) {
      query[key] = safeValue;
    } else if (Array.isArray(existing)) {
      existing.push(safeValue);
    } else {
      query[key] = [existing, safeValue];
    }
  }
  return query;
}

function captureTargetUrl(url: string | URL | null | undefined) {
  if (!url) return null;
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return typeof url === "string" ? url : null;
  }
}

async function captureRequestBody(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const contentType = request.headers.get("content-type") ?? "";
  const clone = request.clone();
  if (contentType.includes("application/json")) {
    try {
      return redactLogObject(await clone.json());
    } catch {
      return null;
    }
  }

  const text = await clone.text();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return captureQuery(new URL(`http://localhost/?${text}`));
  }
  return text || null;
}

function redactInjectedCredentialUrl(rawUrl: string, connection: Connection) {
  const url = new URL(rawUrl);
  if (connection.tokenInject.startsWith("query:")) {
    url.searchParams.set(connection.tokenInject.slice(6), "[redacted]");
  }
  for (const key of url.searchParams.keys()) {
    if (isSensitiveLogKey(key)) url.searchParams.set(key, "[redacted]");
  }
  return url;
}

function isSensitiveLogKey(key: string) {
  return SENSITIVE_LOG_KEYS.has(key.toLowerCase());
}

function redactLogValue(key: string, value: unknown): unknown {
  return isSensitiveLogKey(key) ? "[redacted]" : value;
}

function redactLogObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactLogObject(item));
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = isSensitiveLogKey(key) ? "[redacted]" : redactLogObject(item);
  }
  return result;
}

function isAllowed(
  rules: Array<{ allowedHost: string; pathPattern: string; methods: string }>,
  method: string,
  url: URL,
): boolean {
  return rules.some((rule) => {
    const hostMatch = url.hostname === rule.allowedHost || rule.allowedHost === "*";
    const methodMatch =
      rule.methods === "*" || rule.methods.split(",").includes(method.toUpperCase());
    const pathMatch = rule.pathPattern === "*" || url.pathname.startsWith(rule.pathPattern);
    return hostMatch && methodMatch && pathMatch;
  });
}
