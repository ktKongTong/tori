import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import { createNotificationStreamResponse } from "./route-stream";

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/stream",
  describeRoute({
    tags: ["Notify"],
    summary: "Open notification stream",
    response: { description: "SSE stream", body: z.object({ ok: z.boolean() }) },
  }),
  (c) => createNotificationStreamResponse(c),
);

export default app;
