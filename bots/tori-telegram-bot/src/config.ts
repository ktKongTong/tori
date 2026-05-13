import { loadEnvFile } from "node:process";

loadEnvFile();

export type TelegramBotConfig = {
  telegramBotToken: string;
  toriBaseUrl: string;
  toriBotPluginCredential: string;
  platform: string;
  namespace: string;
  pollTimeoutSeconds: number;
  webhookPath: string;
  webhookPort: number;
  webhookSecret: string | null;
};

function readRequiredEnv(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

function readPositiveIntegerEnv(env: NodeJS.ProcessEnv, key: string, fallback: number) {
  const raw = env[key]?.trim();
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer env: ${key}`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): TelegramBotConfig {
  return {
    telegramBotToken: readRequiredEnv(env, "TELEGRAM_BOT_TOKEN"),
    toriBaseUrl: readRequiredEnv(env, "TORI_BASE_URL").replace(/\/+$/, ""),
    toriBotPluginCredential: readRequiredEnv(env, "TORI_BOT_PLUGIN_CREDENTIAL"),
    platform: env.TORI_BOT_PLATFORM?.trim() || "telegram",
    namespace: env.TORI_BOT_NAMESPACE?.trim() || "managed",
    pollTimeoutSeconds: readPositiveIntegerEnv(env, "TELEGRAM_POLL_TIMEOUT_SECONDS", 30),
    webhookPath: env.TORI_NOTIFICATION_WEBHOOK_PATH?.trim() || "/webhooks/tori/notifications",
    webhookPort: readPositiveIntegerEnv(env, "TELEGRAM_WEBHOOK_PORT", 3081),
    webhookSecret: env.TORI_NOTIFICATION_WEBHOOK_SECRET?.trim() || null,
  };
}
