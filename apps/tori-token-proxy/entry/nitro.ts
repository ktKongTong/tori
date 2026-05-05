import { Hono } from "hono";
import { fetchViteEnv } from "nitro/vite/runtime";
import { isApiRequestPath } from "../src/web-app.ts";

const _app = new Hono();

function shouldHandleSSR(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isApiRequestPath(pathname)) {
    return false;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") || accept.includes("*/*");
}

type NitroEvent = {
  req: Request;
};

export function honoNitroHandler(app: Hono = _app) {
  // register ssr handler
  app.all("*", (c) => {
    if (!shouldHandleSSR(c.req.raw)) {
      return c.notFound();
    }
    return fetchViteEnv("ssr", c.req.raw);
  });

  // bypass ssr fallback,
  // so if hono return 404, the hono response will be send.
  return function handler(event: NitroEvent, _next: unknown) {
    return app.fetch(event.req);
  };
}
