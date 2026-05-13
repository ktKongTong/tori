import { loadConfig } from "./config.js";
import { runTelegramWebhookServer } from "./server.js";
import { runTelegramCommandBot } from "./telegram.js";

const controller = new AbortController();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => controller.abort());
}

const config = loadConfig();

runTelegramWebhookServer({
  config,
  signal: controller.signal,
});

await runTelegramCommandBot({
  config,
  signal: controller.signal,
});
