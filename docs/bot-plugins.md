# Tori Bot Plugins

Tori 的 bot plugin 是外部平台适配器。它不拥有业务命令，不直接读写业务表，也不生成平台无关的业务结果。它只做三件事：

1. 接收平台消息。
2. 把平台消息转换成 `bot-ingress` 的 `commandName`、`commandParams`、`messageContext`。
3. 把 `bot-ingress` 返回的业务 `action/state/context` 渲染成平台消息。

这个边界保证新增 Telegram、Discord、Slack 或其他平台时，不需要把平台 SDK、消息格式、长轮询/webhook 细节塞进 Tori dashboard 或 notify/task 模块。

## Telegram Plugin

`apps/tori-telegram-bot` 是第一个最小可用 bot plugin。它使用 Telegram Bot API long polling 接收用户命令，并用 Hono 暴露 notification webhook 接收 Tori 的主动通知。

### 环境变量

```bash
TELEGRAM_BOT_TOKEN=...
TORI_BASE_URL=http://localhost:3000
TORI_BOT_PLUGIN_CREDENTIAL=...
TORI_BOT_PLATFORM=telegram
TORI_BOT_NAMESPACE=managed
TELEGRAM_POLL_TIMEOUT_SECONDS=30
TELEGRAM_WEBHOOK_PORT=3081
TORI_NOTIFICATION_WEBHOOK_PATH=/webhooks/tori/notifications
TORI_NOTIFICATION_WEBHOOK_SECRET=...
```

`TORI_BOT_PLUGIN_CREDENTIAL` 对应 Tori 后端托管 bot instance 的命令入口凭证。后端会用该凭证约束 platform 与 namespace，plugin 不能冒用其他 bot instance 的消息上下文。

`TORI_NOTIFICATION_WEBHOOK_SECRET` 是 Tori delivery endpoint 调用 Telegram plugin webhook 时使用的共享密钥。它应该与 Tori delivery endpoint 的 `secret` 一致。

### 运行

```bash
vp install
vp run tori-telegram-bot#dev
```

Telegram 用户发送 `/help`、`/status`、`/claim`、`/bind <token>`、`/connect steam id <steamid>`、`/sub steam family`、`/unsub steam family` 时，plugin 会将命令转发到：

```text
POST {TORI_BASE_URL}/api/bot-ingress/request
```

请求使用：

```text
x-bot-plugin-credential: {TORI_BOT_PLUGIN_CREDENTIAL}
```

### 配置 Webhook Delivery Endpoint

Telegram plugin 启动后会监听：

```text
POST http://<telegram-plugin-host>:3081/webhooks/tori/notifications
```

在 Tori 里创建 Telegram bot instance 时同时配置 delivery endpoint：

```json
{
  "platform": "telegram",
  "kind": "webhook",
  "target": "http://<telegram-plugin-host>:3081/webhooks/tori/notifications",
  "displayName": "Telegram Bot Webhook",
  "secret": "same value as TORI_NOTIFICATION_WEBHOOK_SECRET"
}
```

不要给真实 Telegram instance 使用 `internal://...` endpoint；`internal` 只适合 dashboard playground 这类进程内通知流。

因此主动通知的完整链路是：

1. 用户在 Telegram 里发送 `/status`、`/sub ...` 等任意 bot 命令，让 Tori 建立 user binding 和 channel binding。
2. 用户通过 `/sub steam family` 创建订阅。
3. 业务事件产生 notification。
4. Tori 根据 bot instance 找到绑定的 webhook delivery endpoint。
5. Tori POST notification 到 Telegram plugin 的 Hono webhook。
6. Telegram plugin 用 notification 里的 `externalChannelId` 作为 Telegram `chat_id` 调用 Bot API `sendMessage`。

### 消息上下文映射

Telegram private chat 会映射为：

```json
{
  "platform": "telegram",
  "namespace": "managed",
  "channelType": "dm",
  "observedUserId": "telegram user id",
  "observedChannelId": "telegram chat id"
}
```

Telegram group、supergroup、channel 会映射为：

```json
{
  "platform": "telegram",
  "namespace": "managed",
  "channelType": "channel",
  "observedUserId": "telegram user id",
  "observedChannelId": "telegram chat id"
}
```

这让 user binding、channel binding、subscription owner scope 都继续由 bot-ingress 的通用上下文逻辑处理，而不是由 Telegram plugin 自己推断业务身份。

## 后续平台

Discord plugin 应该复用同一个 `bot-ingress` 协议，但 platform/message context 由 Discord guild、channel、user、interaction 或 message event 映射而来。Discord 的 slash command 注册、interaction signature 校验、ephemeral response 等细节属于 Discord plugin 自己的责任，不应该进入 Tori core。
