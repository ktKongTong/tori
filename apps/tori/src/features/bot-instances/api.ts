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

export const dashboardBotInstancesSchema = z.object({
  instances: z.array(
    z.object({
      id: z.string(),
      ownerUserId: z.string(),
      platform: z.string(),
      namespace: z.string(),
      instanceKey: z.string(),
      displayName: z.string(),
      callbackMode: z.string(),
      deliveryEndpointId: z.string().nullable(),
      deliveryEndpointLabel: z.string().nullable(),
      status: z.string(),
      lastSeenAt: z.string().nullable(),
    }),
  ),
  deliveryEndpoints: z.array(
    z.object({
      id: z.string(),
      platform: z.string(),
      kind: z.string(),
      displayName: z.string(),
      target: z.string(),
      status: z.string(),
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

export type DashboardBotInstancesData = z.infer<typeof dashboardBotInstancesSchema>;

export type CreateBotInstanceInput = {
  platform: string;
  namespace: string;
  instanceKey: string;
  displayName: string;
  capabilities?: unknown;
  autoCreateInternalEndpoint: boolean;
};

export type AttachBotInstanceEndpointInput = {
  deliveryEndpointId: string;
};

export const getBotInstances = () =>
  botInstancesRequest.get("/api/dashboard/bot-instances", {
    schema: dashboardBotInstancesSchema,
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
