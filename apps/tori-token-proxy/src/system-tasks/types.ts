export const SYSTEM_TASK_KIND_PROVIDER_REFRESH = "provider.refresh_tokens";

export function createProviderRefreshTaskId(provider: string) {
  return `system.provider.${provider}.refresh`;
}

export function createSystemTaskRunId() {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `taskrun_${rand}`;
}
