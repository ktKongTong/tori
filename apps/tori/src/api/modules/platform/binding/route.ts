import { Hono } from "hono";

import { ParameterError } from "@/api/domain/error/index.ts";
import { requireAuth } from "@/api/server/middleware/auth.ts";
import { describeRoute } from "@/api/server/middleware/openapi/index.ts";
import {
  consumeAnonymousClaim,
  deleteChannelBinding,
  deleteUserBinding,
  issueBindingToken,
} from "./index.js";
import { PageBasedPaginationParamSchema } from "@repo/utils/schema/paging";
import {
  bindingStatusResponseDtoSchema,
  bindingTokenResponseDtoSchema,
  channelBindingListDtoSchema,
  claimSessionListDtoSchema,
  consumeAnonymousClaimDtoSchema,
  consumeAnonymousClaimResponseDtoSchema,
  issueBindingTokenDtoSchema,
  userBindingListDtoSchema,
} from "@/api/modules/platform/binding/contract";

const app = new Hono();

app.use("*", requireAuth());

app.get(
  "/user",
  describeRoute({
    tags: ["Binding"],
    summary: "List user bindings",
    request: { query: PageBasedPaginationParamSchema },
    response: {
      description: "User bindings",
      body: userBindingListDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    const ctx = c.get("serviceContext");
    return c.json(await ctx.repositories.binding.listUserBindingsByUserId(ctx.userId!, page));
  },
);

app.get(
  "/channel",
  describeRoute({
    tags: ["Binding"],
    summary: "List channel bindings",
    request: { query: PageBasedPaginationParamSchema },
    response: {
      description: "Channel bindings",
      body: channelBindingListDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    const ctx = c.get("serviceContext");
    const items = ctx.isAdmin()
      ? await ctx.repositories.binding.listChannelBindings(page)
      : await ctx.repositories.binding.listChannelBindingsForUser(ctx.userId!, page);
    return c.json(items);
  },
);

app.get(
  "/claim-sessions",
  describeRoute({
    tags: ["Binding"],
    summary: "List claim sessions",
    request: { query: PageBasedPaginationParamSchema },
    response: {
      description: "Claim sessions",
      body: claimSessionListDtoSchema,
    },
  }),
  async (c) => {
    const page = c.req.valid("query");
    return c.json(await c.get("serviceContext").repositories.binding.listClaimSessions(page));
  },
);

app.post(
  "/tokens",
  describeRoute({
    tags: ["Binding"],
    summary: "Issue binding token",
    request: { body: issueBindingTokenDtoSchema },
    response: {
      description: "Binding token",
      body: bindingTokenResponseDtoSchema,
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
    request: { body: consumeAnonymousClaimDtoSchema },
    response: {
      description: "Claim result",
      body: consumeAnonymousClaimResponseDtoSchema,
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

app.delete(
  "/user/:id",
  describeRoute({
    tags: ["Binding"],
    summary: "Remove user binding",
    response: {
      description: "Removed binding",
      body: bindingStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    if (!id) throw new ParameterError("User binding id is required");

    const deleted = await deleteUserBinding(c.get("serviceContext"), id);

    return c.json({
      id: deleted.id,
      status: "deleted",
    });
  },
);

app.delete(
  "/channel/:id",
  describeRoute({
    tags: ["Binding"],
    summary: "Remove channel binding",
    response: {
      description: "Removed channel binding",
      body: bindingStatusResponseDtoSchema,
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    if (!id) throw new ParameterError("Channel binding id is required");

    const deleted = await deleteChannelBinding(c.get("serviceContext"), id);

    return c.json({
      id: deleted.id,
      status: "deleted",
    });
  },
);

export default app;
