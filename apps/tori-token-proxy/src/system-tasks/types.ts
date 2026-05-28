import { randomCode } from "@repo/utils/random";

export const SYSTEM_TASK_KIND_PROVIDER_REFRESH = "provider.refresh_tokens";
export const SYSTEM_TASK_KIND_REQUEST_LOG_RETENTION = "request_logs.retention";
export const REQUEST_LOG_RETENTION_TASK_ID = "system.request_logs.retention";
export const REQUEST_LOG_RETENTION_DAYS = 7;

export function createProviderRefreshTaskId(provider: string) {
  return `system.provider.${provider}.refresh`;
}

export function createSystemTaskRunId() {
  return randomCode("taskrun", 16);
}
