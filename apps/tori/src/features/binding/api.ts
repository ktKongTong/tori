import { createRequestClient } from "@repo/request";
import type { PageBasedPaginationParam } from "@repo/utils/schema/paging";
import {
  bindingStatusResponseDtoSchema,
  bindingTokenResponseDtoSchema,
  channelBindingListDtoSchema,
  claimSessionListDtoSchema,
  consumeAnonymousClaimResponseDtoSchema,
  type ChannelBindingDto,
  type UserBindingDto,
  userBindingListDtoSchema,
} from "@/api/modules/platform/binding/contract";

const bindingRequest = createRequestClient({
  credentials: "include",
  retry: 0,
  timeout: 10000,
  headers: {
    accept: "application/json",
  },
});

export const userBindingsSchema = userBindingListDtoSchema;
export const channelBindingsSchema = channelBindingListDtoSchema;
export const claimSessionsSchema = claimSessionListDtoSchema;

export type UserBindingListItem = {
  binding: UserBindingDto;
  user: { id: string; name: string } | null;
};
export type ChannelBindingListItem = {
  binding: ChannelBindingDto;
  channel: { id: string; name: string | null } | null;
  botInstance: { id: string; displayName: string | null } | null;
};

export const listUserBindings = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  bindingRequest.get("/api/binding/user-bindings", {
    query: pagination,
    schema: userBindingListDtoSchema,
  });

export const listChannelBindings = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  bindingRequest.get("/api/binding/channel-bindings", {
    query: pagination,
    schema: channelBindingListDtoSchema,
  });

export const listClaimSessions = (
  pagination: PageBasedPaginationParam = { page: 1, pageSize: 100 },
) =>
  bindingRequest.get("/api/binding/claim-sessions", {
    query: pagination,
    schema: claimSessionListDtoSchema,
  });

export const issueBindingToken = (subjectId: string) =>
  bindingRequest.post(
    "/api/binding/tokens",
    {
      purpose: "bind-user",
      subjectType: "user",
      subjectId,
      issuedToSurface: "bot",
    },
    { schema: bindingTokenResponseDtoSchema },
  );

export const consumeAnonymousClaim = (token: string) =>
  bindingRequest.post(
    "/api/binding/anonymous-claims/consume",
    { token },
    { schema: consumeAnonymousClaimResponseDtoSchema },
  );

export const revokeUserBinding = (bindingId: string) =>
  bindingRequest.post(
    `/api/binding/user-bindings/${encodeURIComponent(bindingId)}/revoke`,
    undefined,
    { schema: bindingStatusResponseDtoSchema },
  );
