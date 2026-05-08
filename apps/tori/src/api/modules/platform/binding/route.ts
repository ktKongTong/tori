import { Hono } from "hono";
import { z } from "zod";

import { ParameterError } from "@/api/domain/error/index.ts";
import { requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import { consumeAnonymousClaim, issueBindingToken, revokeUserBinding } from "./index.js";

const app = new Hono();

const issueBindingTokenSchema = z.object({
  purpose: z.literal("bind-user"),
  subjectType: z.literal("user"),
  subjectId: z.string().min(1),
  issuedToSurface: z.literal("bot"),
  codeExpiresAt: z.string().datetime().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const consumeAnonymousClaimSchema = z.object({
  token: z.string().min(1),
});

app.use("*", requireAuth());

app.get(
  "/user-bindings",
  describeRoute({
    tags: ["Binding"],
    summary: "List user bindings",
    response: {
      description: "User bindings",
      body: z.object({
        items: z.array(z.unknown()),
      }),
    },
  }),
  async (c) => {
    const items = await c.get("serviceContext").repositories.binding.listUserBindings();
    return c.json({ items });
  },
);

app.get(
  "/channel-bindings",
  describeRoute({
    tags: ["Binding"],
    summary: "List channel bindings",
    response: {
      description: "Channel bindings",
      body: z.object({
        items: z.array(z.unknown()),
      }),
    },
  }),
  async (c) => {
    const items = await c.get("serviceContext").repositories.binding.listChannelBindings();
    return c.json({ items });
  },
);

app.get(
  "/claim-sessions",
  describeRoute({
    tags: ["Binding"],
    summary: "List claim sessions",
    response: {
      description: "Claim sessions",
      body: z.object({
        items: z.array(z.unknown()),
      }),
    },
  }),
  async (c) => {
    const items = await c.get("serviceContext").repositories.binding.listClaimSessions();
    return c.json(items);
  },
);

app.post(
  "/tokens",
  describeRoute({
    tags: ["Binding"],
    summary: "Issue binding token",
    request: { body: issueBindingTokenSchema },
    response: {
      description: "Binding token",
      body: z.object({
        grantId: z.string(),
        code: z.string(),
        token: z.string(),
        purpose: z.string(),
        subjectType: z.string(),
        subjectId: z.string(),
        codeExpiresAt: z.string(),
        tokenExpiresAt: z.string(),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await issueBindingToken(c.get("serviceContext"), body);

    return c.json(
      {
        grantId: result.grant.id,
        code: result.grant.code,
        token: result.plaintextToken,
        purpose: result.grant.purpose,
        subjectType: result.grant.subjectType,
        subjectId: result.grant.subjectId,
        codeExpiresAt: result.grant.codeExpiresAt.toISOString(),
        tokenExpiresAt: result.grant.tokenExpiresAt.toISOString(),
      },
      201,
    );
  },
);

app.post(
  "/anonymous-claims/consume",
  describeRoute({
    tags: ["Binding"],
    summary: "Consume anonymous claim token",
    request: { body: consumeAnonymousClaimSchema },
    response: {
      description: "Claim result",
      body: z.object({
        claimSessionId: z.string(),
        anonymousUserId: z.string(),
        authenticatedUserId: z.string(),
        resolution: z.enum(["claimed", "merged"]),
      }),
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const result = await consumeAnonymousClaim(c.get("serviceContext"), body);

    return c.json({
      claimSessionId: result.claimSession.id,
      anonymousUserId: result.anonymousUser.id,
      authenticatedUserId: result.authenticatedUserId,
      resolution: result.resolution,
    });
  },
);

app.post(
  "/user-bindings/:id/revoke",
  describeRoute({
    tags: ["Binding"],
    summary: "Revoke user binding",
    response: {
      description: "Revoked binding",
      body: z.object({
        id: z.string(),
        status: z.string(),
      }),
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    if (!id) throw new ParameterError("User binding id is required");

    const revoked = await revokeUserBinding(c.get("serviceContext"), id);

    return c.json({
      id: revoked.id,
      status: revoked.status,
    });
  },
);

export default app;
