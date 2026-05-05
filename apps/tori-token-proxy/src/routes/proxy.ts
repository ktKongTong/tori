import { Hono } from "hono";
import { decrypt } from "../crypto/index.ts";
import type { Repository } from "../repository/types.ts";
import type { Connection } from "../types.ts";

interface ProxyDeps {
  repo: Repository;
  secret: string;
}

export function proxyRoutes(deps: ProxyDeps) {
  const { repo, secret } = deps;
  const app = new Hono();

  // ─── ALL /proxy/:provider/* ───
  // Transparent proxy: method + body pass through as-is
  // Target URL via X-PROXY-URL header
  app.all("/:provider{.+}", async (c) => {
    const conn = c.get("connection") as Connection;
    const provider = c.req.param("provider");

    // Verify connection matches provider
    if (conn.provider !== provider) {
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        targetUrl: c.req.header("X-PROXY-URL") ?? null,
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
        targetUrl,
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
        targetUrl,
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
        targetUrl,
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
    const forwardHeaders = ["content-type", "accept", "accept-language"];
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
      body = await c.req.arrayBuffer();
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
      await repo.createRequestLog({
        connectionId: conn.id,
        routeGroup: "proxy",
        method: c.req.method,
        targetUrl: finalUrl,
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
    await repo.createRequestLog({
      connectionId: conn.id,
      routeGroup: "proxy",
      method: c.req.method,
      targetUrl: finalUrl,
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
