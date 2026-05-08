import { createRequestClient } from "@repo/request";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";
import {
  attachBotInstanceEndpointResponseDtoSchema,
  botInstanceListDtoSchema,
  botInstanceStatusResponseDtoSchema,
  createBotInstanceResponseDtoSchema,
  rotateBotInstanceCredentialResponseDtoSchema,
  type AttachEndpointDto,
  type CreateBotInstanceDto,
} from "@/api/modules/platform/bot-plugin/contract";

const botInstancesRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const botInstancesSchema = botInstanceListDtoSchema;

export const listBotInstances = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  botInstancesRequest.get("/api/bot-plugin/instances", {
    query: pagination,
    schema: botInstanceListDtoSchema,
  });

export const createBotInstance = (input: CreateBotInstanceDto) =>
  botInstancesRequest.post("/api/bot-plugin/instances", input, {
    schema: createBotInstanceResponseDtoSchema,
  });

export const rotateBotInstanceCredential = (id: string) =>
  botInstancesRequest.post(
    `/api/bot-plugin/instances/${encodeURIComponent(id)}/rotate-credential`,
    undefined,
    { schema: rotateBotInstanceCredentialResponseDtoSchema },
  );

export const revokeBotInstance = (id: string) =>
  botInstancesRequest.post(
    `/api/bot-plugin/instances/${encodeURIComponent(id)}/revoke`,
    undefined,
    {
      schema: botInstanceStatusResponseDtoSchema,
    },
  );

export const attachBotInstanceEndpoint = (id: string, input: AttachEndpointDto) =>
  botInstancesRequest.post(
    `/api/bot-plugin/instances/${encodeURIComponent(id)}/attach-endpoint`,
    input,
    { schema: attachBotInstanceEndpointResponseDtoSchema },
  );
