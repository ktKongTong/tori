export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitterRatio?: number;
};

export function shouldRetry(attempt: number, policy: RetryPolicy) {
  return attempt < policy.maxAttempts;
}

export function nextRetryDelayMs(attempt: number, policy: RetryPolicy, random = Math.random) {
  const multiplier = policy.multiplier ?? 2;
  const exponential = policy.baseDelayMs * multiplier ** Math.max(0, attempt - 1);
  const capped = Math.min(exponential, policy.maxDelayMs ?? exponential);
  const jitterRatio = policy.jitterRatio ?? 0;
  if (jitterRatio <= 0) return capped;
  const jitter = capped * jitterRatio * random();
  return Math.round(capped - jitter / 2 + jitter);
}
