import handler from "@tanstack/react-start/server-entry";
import { Hono } from "hono";
import { createApp, registerApiV2Runtime } from "@/api";
import { cloudflareServerAdapter } from "../adapter/cloudflare/server";
import { cloudflareCronAdapter } from "../adapter/cloudflare/cron";
import { cloudflareMQAdapter } from "../adapter/cloudflare/queue";
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

registerApiV2Runtime();
app.route("/api", createApp({ adapter: cloudflareServerAdapter }));

app.use("*", async (c) => {
  if (!shouldHandleSSR(c.req.raw)) {
    return c.notFound();
  }

  return handler.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  queue: cloudflareMQAdapter,
  scheduled: cloudflareCronAdapter,
};
