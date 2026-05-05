import { Hono } from "hono";

export function healthRoutes() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "token-proxy", version: "0.1.0" });
  });

  return app;
}
