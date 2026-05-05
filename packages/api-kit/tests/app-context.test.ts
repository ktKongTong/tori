import { describe, expect, it } from "vite-plus/test";
import { createApiApp, createSessionMiddleware, getApiRequestContext } from "../src/index.ts";

describe("api app composition", () => {
  it("sets request context before routes run", async () => {
    const app = createApiApp({
      context: {
        env: { service: "test" },
        createRequestId: () => "request-1",
      },
    });

    app.get("/ctx", (context) => {
      const requestContext = getApiRequestContext<{ service: string }>(context);
      return context.json({
        requestId: requestContext.requestId,
        env: requestContext.env,
        startedAt: requestContext.startedAt.toISOString(),
      });
    });

    const response = await app.request("/ctx");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requestId: "request-1",
      env: { service: "test" },
      startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("attaches resolved sessions to request context", async () => {
    const app = createApiApp();
    app.use(
      "*",
      createSessionMiddleware({
        resolve: async () => ({ userId: "user-1" }),
        required: true,
      }),
    );
    app.get("/me", (context) => {
      const requestContext = getApiRequestContext<unknown, { userId: string }>(context);
      return context.json({ userId: requestContext.session?.userId });
    });

    const response = await app.request("/me");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "user-1" });
  });

  it("normalizes middleware errors through the app error handler", async () => {
    const app = createApiApp({ context: { createRequestId: () => "request-denied" } });
    app.use("*", createSessionMiddleware({ resolve: async () => null, required: true }));
    app.get("/private", (context) => context.json({ ok: true }));

    const response = await app.request("/private");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      traceId: "request-denied",
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
  });
});
