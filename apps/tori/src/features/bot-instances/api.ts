import { createRequestClient } from "@repo/request";
import { z } from "zod";

const botInstancesRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const botInstancesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      ownerUserId: z.string(),
      platform: z.string(),
      namespace: z.string(),
      instanceKey: z.string(),
      displayName: z.string().nullable(),
      callbackMode: z.string(),
      deliveryEndpointId: z.string().nullable(),
      status: z.string(),
      lastSeenAt: z.string().nullable(),
    }),
  ),
});

const statusResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

const createBotInstanceResponseSchema = z.object({
  id: z.string(),
  plaintextCredential: z.string(),
  deliveryEndpointId: z.string().nullable(),
  created: z.boolean(),
});

const rotateBotInstanceCredentialResponseSchema = z.object({
  id: z.string(),
  plaintextCredential: z.string(),
});

const attachBotInstanceEndpointResponseSchema = z.object({
  id: z.string(),
  deliveryEndpointId: z.string().nullable(),
});

export type BotInstanceRow = z.infer<typeof botInstancesSchema>["items"][number];

export type CreateBotInstanceInput = {
  platform: string;
  namespace: string;
  instanceKey: string;
  displayName: string;
  capabilities?: unknown;
  deliveryEndpoint?: {
    kind: string;
    target: string;
    displayName?: string | null;
    secret?: string | null;
    config?: unknown;
    metadata?: unknown;
  };
};

export type AttachBotInstanceEndpointInput = {
  deliveryEndpointId: string;
};

export const listBotInstances = () =>
  botInstancesRequest.get("/api/bot-plugin/instances", {
    schema: botInstancesSchema,
  });

export const createBotInstance = (input: CreateBotInstanceInput) =>
  botInstancesRequest.post("/api/bot-plugin/instances", input, {
    schema: createBotInstanceResponseSchema,
  });

export const rotateBotInstanceCredential = (id: string) =>
  botInstancesRequest.post(
    `/api/bot-plugin/instances/${encodeURIComponent(id)}/rotate-credential`,
    undefined,
    { schema: rotateBotInstanceCredentialResponseSchema },
  );

export const revokeBotInstance = (id: string) =>
  botInstancesRequest.post(
    `/api/bot-plugin/instances/${encodeURIComponent(id)}/revoke`,
    undefined,
    {
      schema: statusResponseSchema,
    },
  );

export const attachBotInstanceEndpoint = (id: string, input: AttachBotInstanceEndpointInput) =>
  botInstancesRequest.post(
    `/api/bot-plugin/instances/${encodeURIComponent(id)}/attach-endpoint`,
    input,
    { schema: attachBotInstanceEndpointResponseSchema },
  );
