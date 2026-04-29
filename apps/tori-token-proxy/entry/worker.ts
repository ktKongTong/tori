import handler from "@tanstack/react-start/server-entry";
import { Hono } from "hono";
import { api } from "@/api";
function shouldHandleSSR(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return false;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") || accept.includes("*/*");
}
const app = new Hono();

app.route("/api", api);

app.use("*", async (c) => {
  if (!shouldHandleSSR(c.req.raw)) {
    return c.notFound();
  }

  return handler.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  scheduled: async () => {
    console.log("example cron");
  },
};
