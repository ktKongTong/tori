import { randomCode } from "@repo/utils/random";

export const SYSTEM_TASK_KIND_PROVIDER_REFRESH = "provider.refresh_tokens";

export function createProviderRefreshTaskId(provider: string) {
  return `system.provider.${provider}.refresh`;
}

export function createSystemTaskRunId() {
  return randomCode("taskrun", 16);
}
