# Tori 架构体系与业务协议

本文档描述当前 Tori 的后端架构、业务资源模型，以及 Tori 与 token-proxy、bot plugin 的交互协议。文档以当前代码中的模块边界和资源职责为准。

## 1. 总体架构

Tori 是一个模块化单体。代码组织按能力垂直切片，而不是按 controller/service/repository 横向分层。每个业务能力尽量自己拥有：

- HTTP contract
- route
- command
- repository port
- repository implementation
- event consumer
- mapper
- 前端 API client 和 feature UI

后端模块分为三层：

```txt
infra
  -> platform modules
    -> business modules
```

### Infra

Infra 提供技术基础设施，不表达产品业务。

主要能力：

- `ServiceContext`：请求、事件、cron 的统一上下文。
- `ctx.repositories`：模块 repository 的组合入口。
- `ctx.sendEvent`：写入 outbox。
- `eventRouter`：消费 MQ/outbox 事件。
- `cronRegistry`：注册定时任务。
- `withImplicitTx`：PG 隐式事务上下文。

关键目录：

```txt
apps/tori/src/api/domain/infra
apps/tori/src/api/support
apps/tori/src/api/server
```

Infra 可以被 platform 和 business module 使用，但不应该反向依赖它们。

### Platform Modules

Platform module 是 Tori 的通用产品能力。它们可以互相依赖，但资源所有权必须清楚。

当前核心模块：

- `platform/integration`：proxy instance 管理、provider registry。
- `platform/connection`：provider account connection、token-proxy connection session、connection credential。
- `platform/binding`：user binding、channel binding、claim/binding grant。
- `platform/bot-plugin`：托管 bot instance、runtime credential、delivery endpoint 关联。
- `platform/bot-ingress`：bot command ingress、message context 解析、通用命令执行。
- `platform/subscription`：订阅规则生命周期。
- `platform/notify`：notification event、candidate 生成、delivery、SSE stream。
- `platform/task`：task definition、task run、cron scanner、task runner。
- `platform/shared`：跨 platform module 的纯 DTO/helper，例如 action check schema。

事件也归资源 owner 所在模块，不单独建立 lifecycle 业务模块：

- connection event 属于 `platform/connection`。
- proxy instance event 属于 `platform/integration`。
- channel binding event 属于 `platform/binding`。
- bot instance event 属于 `platform/bot-plugin`。
- task event 属于 `platform/task`。

### Business Modules

Business module 是具体 provider/domain 的业务域。

当前主要 business module：

- `steam`

Steam module 负责 Steam-specific 的账号、家庭、库、任务处理、事件适配。它消费 platform 的 connection、subscription、task、notify 能力，但 Steam-specific 逻辑不进入 platform module。

## 2. 运行时模型

Tori 的运行时由四类入口组成。

### HTTP Request

Dashboard、token-proxy callback、bot plugin request 都通过 Hono route 进入 Tori API。

Route 负责：

- request validation
- OpenAPI metadata
- 调用 command/repository
- response shaping

Route 不应该直接写复杂 DB 逻辑。

### Outbox / MQ Event

业务 command 通过 `ctx.sendEvent` 写 outbox event。outbox cron 定时发布 MQ：

```txt
command
  -> ctx.sendEvent(...)
  -> outbox table
  -> outbox cron
  -> MQ
  -> eventRouter
  -> module-owned consumer
```

事件消费必须幂等。重复消费不应该破坏状态。

### Cron

平台 cron 用于扫描和触发异步工作。

当前重要 cron：

- `platform.task.scan-due`：扫描 due task definition，创建 task run，并写 `TASK_RUN_REQUESTED` outbox event。
- `process-outbox`：处理 outbox。

### Runtime Resolver

Tori 不依赖异步级联一定已经完成。所有运行时入口都必须检查依赖链：

- connection resolver 只返回 active 且未删除 connection。
- token-proxy connect 只允许 active proxy instance。
- notification candidate 只允许 active subscription、active channel binding、active bot instance、active delivery endpoint。
- task scanner 只扫描 enabled 且未删除 task definition。
- task runner 执行前重新读取 task definition 和上游资源。
- bot ingress 必须校验 bot instance credential、platform、namespace。

## 3. 业务资源模型

### User Profile

`user_profile` 是 Tori 用户的展示资料扩展。

核心字段：

- `userId`
- `displayName`
- `avatarUrl`
- `locale`
- `timezone`
- `metadata`

认证用户本体来自 auth schema；`user_profile` 不承担认证职责。

### Channel

`channel` 是 Tori 内部的通知/命令上下文。

核心字段：

- `id`
- `type`
- `name`
- `status`
- `metadata`
- `createdByUserId`
- `deletedAt`

外部平台 channel 不直接等于 Tori channel。外部 channel 通过 `channel_binding` 映射到内部 channel。

### User Binding

`user_binding` 绑定 Tori user 与外部平台 user。

核心字段：

- `userId`
- `platform`
- `externalUserId`
- `externalUserName`
- `namespace`
- `source`
- `assurance`
- `status`
- `revokedReason`
- `endedAt`
- `deletedAt`

业务语义：

- active binding 表示外部 user 当前可解析为 Tori user。
- revoked binding 表示绑定关系终止。
- deleted binding 从普通查询中隐藏，但历史可保留。

唯一约束按 `deletedAt IS NULL` 过滤，让删除后的外部身份可以重新绑定。

### Channel Binding

`channel_binding` 绑定 Tori channel 与外部平台 channel。

核心字段：

- `channelId`
- `platform`
- `externalChannelId`
- `externalChannelName`
- `namespace`
- `botPluginInstanceId`
- `source`
- `assurance`
- `status`
- `revokedReason`
- `endedAt`
- `deletedAt`

业务语义：

- channel binding 决定 bot command 和 notification delivery 的 channel 归属。
- bot plugin 上报 message context 时，bot-ingress 会根据 platform/externalChannelId/namespace 找或建 channel binding。
- channel binding revoke 后，相关 subscription 应通过对应 module event 异步禁用。

### Claim Session 与 Binding Grant

`binding_grant` 是一次可兑换的绑定授权。

`claim_session` 是 bot 场景中的匿名身份认领流程。

典型流程：

```txt
bot user sends /claim
  -> bot-ingress creates binding_grant + claim_session
  -> user opens dashboard and redeems token
  -> Tori resolves anonymous user to authenticated user
  -> user_binding is confirmed or merged
```

这两个表是流程历史和诊断对象，不是普通业务资源删除对象。

### Proxy Instance

`proxy_instance` 是 Tori 对外部 token-proxy 节点的登记记录。

核心字段：

- `ownerUserId`
- `provider`
- `name`
- `baseUrl`
- `credentialRef`
- `status`
- `healthStatus`
- `capabilities`
- `metadata`
- `lastSeenAt`
- `deletedAt`

职责：

- 描述一个 token-proxy endpoint。
- 保存访问 token-proxy admin API 所需的 credential reference。
- 暴露 provider capabilities，供 connection form 判断可连接 provider。
- 作为 proxy-backed connection credential 的上游依赖。

Proxy instance 属于 `platform/integration`，不是 connection 的子资源。

### Connection

`connection` 是 Tori 用户连接到外部 provider account 的账号身份。

核心字段：

- `ownerUserId`
- `proxyInstanceId`
- `provider`
- `providerAccountId`
- `providerAccountName`
- `providerAccountAvatar`
- `accessMode`
- `status`
- `isDefault`
- `metadata`
- `connectedAt`
- `lastSyncedAt`
- `deletedAt`

业务语义：

- connection 表示“哪个 Tori 用户连接了哪个 provider account”。
- public-id connection 可以只依赖公开 provider id。
- proxy-token connection 依赖 token-proxy credential。
- mixed connection 可以同时支持 public access 和 proxy-backed access。

唯一约束按：

```txt
ownerUserId + provider + providerAccountId + accessMode
where deletedAt IS NULL
```

这意味着删除 connection 后可以重新连接同一 provider account。

### Connection Credential

`connection_credential` 保存 connection 的运行凭证引用。

核心字段：

- `connectionId`
- `proxyInstanceId`
- `kind`
- `credentialRef`
- `status`
- `metadata`
- `lastUsedAt`
- `expiresAt`
- `deletedAt`

当前 token-proxy credential 使用：

```txt
kind = token-proxy-api-key
credentialRef = token-proxy exchange 返回的 apiKey
```

credential 是敏感/可替换对象。connection 删除时可以内部清理 credential，但不应该删除 notification event 或 task run 历史。

### Token Proxy Connection Session

`token_proxy_connection_session` 是 Tori 创建的短效外部连接流程会话。

核心字段：

- `state`
- `ownerUserId`
- `proxyInstanceId`
- `provider`
- `accessMode`
- `status`
- `callbackUrl`
- `tokenProxyConnectUrl`
- `tokenProxyCode`
- `connectionId`
- `error`
- `expiresAt`
- `completedAt`

它只负责一次 popup external connect 流程，不是长期业务授权。

### Bot Plugin Instance

`bot_plugin_instance` 是 Tori 托管的 bot runtime instance。

核心字段：

- `ownerUserId`
- `platform`
- `namespace`
- `instanceKey`
- `displayName`
- `callbackMode`
- `deliveryEndpointId`
- `status`
- `capabilities`
- `metadata`
- `lastSeenAt`
- `deletedAt`

职责：

- 给外部 bot plugin 分配 runtime credential。
- 限定 bot plugin 只能提交自身 platform/namespace 的 message context。
- 关联一个 delivery endpoint，用于主动通知投递。

runtime credential hash 当前存放在 `metadata.runtimeCredentialHash`。

### Delivery Endpoint

`delivery_endpoint` 描述 notification 的投递目标。

核心字段：

- `ownerUserId`
- `platform`
- `kind`
- `displayName`
- `target`
- `secret`
- `status`
- `config`
- `metadata`
- `lastUsedAt`
- `deletedAt`

当前支持：

- `kind = webhook`：Tori POST 到外部 bot plugin webhook。
- 非 webhook：通过进程内 notify bus / SSE stream 投递。

### Subscription

`subscription` 描述用户希望持续接收的事件规则。

核心字段：

- `channelId`
- `botPluginInstanceId`
- `connectionId`
- `ownerType`
- `ownerId`
- `topicType`
- `topicKey`
- `eventTypes`
- `status`
- `filterExpr`
- `createdByUserId`
- `deletedAt`

创建 subscription 必须校验：

- connection active。
- channel binding active。
- bot plugin instance 可解析。

subscription 激活会写 outbox event。Steam adapter 监听 subscription lifecycle event，为 Steam family subscription 确保 refresh task definition。

### Notification Event

`notification_event` 是投递历史。

核心字段：

- `subscriptionId`
- `channelId`
- `botPluginInstanceId`
- `deliveryEndpointId`
- `channelBindingId`
- `title`
- `body`
- `payload`
- `status`
- `sentAt`
- `failedAt`
- `errorMessage`
- `createdAt`

notification event 是诊断/历史数据，不随 connection、subscription、bot instance 的 delete 被硬删。

### Task Definition 与 Task Run

`task.definition` 描述可重复调度的工作。

核心字段：

- `ownerUserId`
- `kind`
- `enabled`
- `schedule`
- `payload`
- `lastTriggeredAt`
- `lastRunAt`
- `lastRunStatus`
- `lastError`
- `metadata`

`task.run` 是一次执行历史。

核心字段：

- `taskDefinitionId`
- `kind`
- `status`
- `summary`
- `errorMessage`
- `scheduledFor`
- `startedAt`
- `finishedAt`
- `createdAt`

task run 是历史数据，不应在用户删除 task definition 时硬删。

## 4. 删除、禁用与查询规则

业务删除不应该用 `status = deleted` 单独表达。删除应使用独立字段，通常是：

```ts
deletedAt: Date | null;
```

查询规则：

- 普通业务查询默认加 `isNull(deletedAt)`。
- 唯一索引默认只约束 `deletedAt IS NULL` 的记录。
- 管理/历史查询可以显式包含 deleted 记录。
- runtime resolver 必须排除 `deletedAt IS NOT NULL` 的记录。

状态字段表达运行状态或关系状态：

- `active`
- `disabled`
- `revoked`
- `superseded`
- `pending`
- `completed`
- `failed`

`deletedAt` 表达可见性和业务删除，不和 runtime status 混在一起。

禁用语义：

- `disabled` 记录可查询。
- runtime 不使用 disabled 资源。
- disable 可以通过 module event 异步影响下游资源。

撤销语义：

- revoke 用于 binding / credential / authorization 类关系终止。
- revoked 记录保留历史。
- 普通 active 查询不返回 revoked。

内部清理：

- credential secret / credential reference
- token-proxy session
- expired claim/session
- Steam cache
- retention 过期历史

这些可以物理删除，但不能顺带删除 notification event、task run 等诊断历史。

## 5. Action Check 与异步级联

Dashboard destructive action 不直接执行。先调用资源 owner 模块的 action-check endpoint。

当前形态：

```txt
POST /api/integration/connections/:id/action-check
POST /api/integration/proxy-instances/:id/action-check
POST /api/bot-plugin/instances/:id/action-check
```

Action check 返回：

- 当前资源。
- action。
- 是否允许。
- summary。
- affected。
- asyncEffects。
- retained。
- internalCleanup。
- runtimeEffects。
- warnings。

Action check 只做轻量影响提示，不递归计算完整依赖图。

实际 action 同步做：

- 当前资源状态或 `deletedAt` 更新。
- 必要安全状态更新，例如 credential 禁用/清理。
- 写 outbox event。

下游级联通过 owner module event consumer 处理：

- `platform.connection.disabled`
- `platform.connection.deleted`
- `platform.proxy-instance.disabled`
- `platform.proxy-instance.deleted`
- `platform.channel-binding.revoked`
- `platform.bot-instance.disabled`
- `platform.bot-instance.deleted`

## 6. Token-Proxy 交互协议

token-proxy 是外部凭证代理。Tori 不直接实现 provider 登录，而是通过 proxy instance 发起 external connect。

### 参与方

- Tori Web：打开 popup，接收完成通知。
- Tori API：创建 connect session，处理 callback，写 connection 和 credential。
- token-proxy Web/API：完成 provider auth、账号选择、credential 创建。
- Provider：例如 Steam。

### Step 1: Tori Web 请求启动连接

```http
POST /api/integration/proxy-instances/:id/connections/start
Content-Type: application/json
```

```json
{
  "provider": "steam",
  "accessMode": "proxy-token"
}
```

Tori API 校验：

- 用户已登录。
- proxy instance 属于当前用户。
- proxy instance active。
- proxy capabilities 支持 provider。

Tori API 创建：

- `token_proxy_connection_session`
- `state`
- callback URL
- token-proxy external connect URL

返回：

```json
{
  "sessionId": "...",
  "state": "tp_state_...",
  "connectUrl": "https://proxy.example.com/admin/external-connect?...",
  "expiresAt": "..."
}
```

### Step 2: Browser 打开 token-proxy popup

Tori Web 使用：

```ts
window.open(connectUrl, "tori-token-proxy-connect", "popup,width=720,height=860");
```

Tori Web 监听：

- `window.message`
- `BroadcastChannel("tori-token-proxy-connect:" + state)`

### Step 3: token-proxy external connect

Tori 生成的 URL 形态：

```txt
GET {proxy.baseUrl}/admin/external-connect
  ?provider=steam
  &state=...
  &callback=...
  &label=Tori
  &permissions=proxy,account,steam-family
```

token-proxy UI 的正确交互：

- 优先展示 token-proxy 已有 token/account。
- 用户可以选择已有 account 进行连接。
- 另外提供新建按钮，用于新增 provider auth。
- 用户确认后，token-proxy 创建或复用 proxy credential，并 redirect 到 Tori callback。

### Step 4: Tori callback exchange

token-proxy redirect：

```txt
GET /api/integration/connections/token-proxy/callback
  ?sessionId=...
  &state=...
  &code=...
```

Tori API 校验：

- session 存在。
- session 属于当前用户。
- state 匹配。
- session pending。
- session 未过期。
- proxy instance active。

然后请求 token-proxy：

```http
POST {proxy.baseUrl}/admin/external-connect/exchange
Content-Type: application/json
```

```json
{
  "code": "...",
  "state": "..."
}
```

token-proxy 返回：

```ts
type TokenProxyExchangeResponse = {
  connection: {
    id: string;
    provider: string;
    providerUid: string;
    displayName: string | null;
    permissions: string[];
  };
  apiKey: string;
  account?: {
    providerAccountId: string;
    providerAccountName?: string | null;
    providerAccountAvatar?: string | null;
  };
};
```

Tori 写入：

- `connection`
- `connection_credential`
- complete `token_proxy_connection_session`

`connection.metadata` 保存 token-proxy connection id、provider、display name、permissions。

`connection_credential.credentialRef` 当前保存 token-proxy 返回的 `apiKey`。

### Step 5: Popup 通知 Dashboard

callback HTML 发送：

```ts
{
  type: "tori:token-proxy-connect",
  state,
  status: "completed",
  connection
}
```

发送渠道：

- `window.opener.postMessage`
- `BroadcastChannel`

Dashboard 收到后刷新 connection list。

## 7. Bot Plugin 与 Bot Ingress 协议

bot plugin 是外部平台适配器，不拥有 Tori 业务逻辑。

职责边界：

- plugin 接收平台消息。
- plugin 将平台消息转换为 Tori bot-ingress request。
- Tori bot-ingress 解析上下文、执行业务命令。
- plugin 将 Tori 返回的业务结果渲染成平台消息。

### Bot Instance 创建与 Credential

Dashboard 创建 bot instance：

```http
POST /api/bot-plugin/instances
```

输入包含：

- `platform`
- `namespace`
- `instanceKey`
- `displayName`
- `deliveryEndpoint`

Tori 返回 plaintext credential。之后只保存 hash：

```txt
bot_plugin_instance.metadata.runtimeCredentialHash
```

plugin 后续请求使用：

```txt
x-bot-plugin-credential: <credential>
```

也支持 bearer：

```txt
Authorization: Bearer <credential>
```

### Bot Ingress Request

```http
POST /api/bot-ingress/request
x-bot-plugin-credential: ...
Content-Type: application/json
```

```ts
type CommandRequest = {
  commandName: string;
  commandParams: string[];
  messageContext: {
    platform: string;
    namespace?: string | null;
    observedUserId: string;
    observedUserName: string;
    observedChannelId: string;
    observedChannelName: string;
    channelType: string;
    channelName: string;
    rawPayload?: Record<string, unknown>;
  };
};
```

Tori 校验：

- credential 对应 active bot instance。
- messageContext.platform 等于 bot instance platform。
- messageContext.namespace 等于 bot instance namespace，缺省为 `managed`。

### Bot Context Resolution

bot-ingress 根据 messageContext 做上下文解析：

1. 查找 active user binding。
2. 查找 active channel binding。
3. 如果 user binding 不存在，创建 anonymous user 和 self-asserted user binding。
4. 如果 channel binding 不存在，创建 Tori channel 和 channel binding。
5. 如果名称变化，更新 binding/channel display name。
6. 返回 resolved context 给 command。

这个过程让 Telegram、Discord、Slack 等 plugin 不需要理解 Tori 的 user/channel/subscription 内部模型。

### Bot Commands

当前通用命令包括：

- `help`
- `status`
- `claim`
- `bind`
- `connect`
- `sub`
- `unsub`

Steam adapter 注册 Steam-specific subscription target 和 task handlers。

bot command handler 返回业务 action/state/context，plugin 负责渲染成平台消息。

### Bot Notification Delivery

主动通知链路：

```txt
business event
  -> notify.createNotificationCandidates
  -> notification_event
  -> delivery endpoint
  -> webhook or SSE/internal bus
  -> bot plugin
  -> platform API send message
```

Webhook delivery：

```http
POST {deliveryEndpoint.target}
Content-Type: application/json
x-tori-delivery-endpoint-id: ...
x-tori-notification-id: ...
x-tori-delivery-secret: ...
```

body：

```json
{
  "type": "notification",
  "notification": {
    "id": "...",
    "subscriptionId": "...",
    "channelId": "...",
    "botPluginInstanceId": "...",
    "deliveryEndpointId": "...",
    "channelBindingId": "...",
    "externalChannelId": "...",
    "externalChannelName": "...",
    "platform": "telegram",
    "namespace": "managed",
    "status": "sent",
    "title": "...",
    "body": {},
    "payload": {},
    "createdAt": "..."
  }
}
```

Plugin 使用 `externalChannelId` 作为平台 channel/chat id 发送消息。

### SSE Stream

bot instance 没有 webhook endpoint 或 dashboard playground 可使用：

```http
GET /api/bot-ingress/stream
```

stream 会按 botPluginInstanceId / deliveryEndpointId 过滤通知。

## 8. Steam 业务适配

Steam module 位于：

```txt
apps/tori/src/api/modules/steam
```

职责：

- Steam account profile。
- Steam family。
- Steam library。
- Steam provider access。
- Steam subscription target。
- Steam task handlers。
- Steam event consumers。

Steam 不拥有 connection/subscription/task/notify 表。它通过 platform 能力完成：

- 使用 connection resolver 获取 Steam account access。
- 使用 task definition/run 执行 refresh。
- 使用 subscription lifecycle event 确保 Steam refresh task。
- 使用 notify module 生成 delivery candidate。

## 9. 模块依赖规则

推荐依赖方向：

```txt
platform/integration
  owns proxy instance

platform/connection
  owns connection, credential, token-proxy session
  may read proxy instance for token-proxy flow

platform/binding
  owns binding grant, claim session, user/channel binding

platform/bot-plugin
  owns bot instance and delivery endpoint relation

platform/bot-ingress
  consumes binding and bot-plugin to resolve message context

platform/subscription
  owns subscription
  validates connection/channel/bot dependencies

platform/notify
  owns notification event and delivery runtime
  reads subscription/channel/bot/endpoint as candidate dependencies

platform/task
  owns task definition/run

steam
  consumes platform connection/subscription/task/notify
```

不推荐：

- 建立一个抽象的 lifecycle business module 来拥有所有 deleted/disabled/revoked 事件。
- 让 notify 拥有 subscription persistence。
- 让 bot plugin 直接读写业务表。
- 让 token-proxy 细节泄漏到 connection form 之外的业务层。
- 用 `status = deleted` 代替 `deletedAt`。

## 10. 当前实现需要持续校准的点

以下规则应作为后续实现和 review 的标准：

- delete 使用 `deletedAt` 字段，普通查询使用 `isNull(deletedAt)`。
- status 表示 active/disabled/revoked 等业务状态，不表示删除。
- event consumer 放在资源 owner module。
- action-check 是轻量确认，不是同步级联计划。
- 下游级联通过 MQ/outbox 异步处理。
- runtime resolver 永远要校验依赖链。
- notification event、task run、claim session 默认保留。
- credential/session/cache 可以内部清理。
- Dashboard destructive action 使用 AlertDialog，而不是 `window.confirm`。
