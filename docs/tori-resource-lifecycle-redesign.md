# Tori Subscription Scope 与 Channel Delivery 资源生命周期设计

本文档定义 Tori 下一版资源模型和生命周期协议。核心修正是：`subscription` 是一个独立配置实体，它同时连接 owner/scope、data source 和 delivery target；`channel` 是 Tori 内部投递空间；`bot_plugin_instance` 和 `proxy_instance` 都是可替换基础设施，不能成为业务资产的根。

核心结论：

- 用户或 channel 拥有 `subscription`，subscription 最终投递到一个 Tori 内部 `channel`。
- 一个 `channel` 可以有多个 `channel_binding`，分别映射到 Telegram、Discord 等外部聊天室。
- notification 针对内部 `channel` 生成，然后按该 channel 的所有有效 binding fan-out。
- `subscription` 必须明确 `ownerType + ownerId`、`connectionId`、`channelId` 三个维度。
- `subscription` 不保存 `botPluginInstanceId`，也不保存 delivery platform/namespace。
- `channel_binding` 绑定的是 `platform + namespace + externalChannelId`，且必须记录当前负责触达该外部地址的 `botPluginInstanceId`。
- `botPluginInstanceId` 是物理触达权限载体。同平台不同 bot token 的群组触达权限彼此隔离，不能靠 `platform + namespace` 随机选一个 bot 投递。
- bot instance 删除只会让相关 binding 进入 `suspended`，不会删除 binding，更不会影响 subscription。
- proxy instance 删除只会让相关 connection credential 不可用，connection/subscription 保留。
- 删除使用 `deletedAt`；普通查询必须过滤 `deletedAt IS NULL`。

架构原则：

- 业务资产与基础设施解耦：subscription、channel、connection、binding 是业务资产；bot/proxy instance 是可替换基础设施。
- 状态更新替代级联删除：底层依赖断裂时，上层业务资产只做 `suspended` 或 delivery failure，等待新资源接入后恢复。
- 扇出与异构隔离：消息必须经 channel fan-out 到 channel bindings；每条 binding 独立校验自己的 bot runtime，局部失败不能影响其他出口。

## 1. 领域模型

### 1.1 资源关系

```txt
subscription
  -> ownerType + ownerId  // 谁拥有这个配置，决定权限和强生命周期
  -> channelId
  -> connectionId
  -> topic rule

channel
  -> channel_binding[]

channel_binding
  -> channelId
  -> platform + namespace + externalChannelId
  -> current botPluginInstanceId  // 当前物理投递通道

notification_event
  -> subscriptionId
  -> channelId
  -> fan-out delivery attempts by channel_binding
```

subscription 是多方契约。它必须同时回答三个问题：

- 谁拥有这个配置：`ownerType + ownerId`。
- 监听哪个数据源：`connectionId`。
- 通知发到哪里：`channelId`。

`channel` 是投递聚合点。外部平台、bot runtime、delivery endpoint 都在 channel binding 之后。

### 1.2 ER 语义

```txt
USER_PROFILE ||--o{ SUBSCRIPTION : owner when ownerType=user
CHANNEL ||--o{ SUBSCRIPTION : owner when ownerType=channel
CONNECTION ||--o{ SUBSCRIPTION : data source
CHANNEL ||--o{ SUBSCRIPTION : delivery target
CHANNEL ||--o{ CHANNEL_BINDING
SUBSCRIPTION ||--o{ NOTIFICATION_EVENT
NOTIFICATION_EVENT }o--|| CHANNEL
CHANNEL_BINDING }o--o| BOT_PLUGIN_INSTANCE
CONNECTION ||--o{ CONNECTION_CREDENTIAL
CONNECTION_CREDENTIAL }o--o| PROXY_INSTANCE
```

关键点：

- `subscription` 和 `bot_plugin_instance` 没有直接关系。
- `subscription` 的 owner 决定生命周期和权限。
- `subscription.connectionId` 决定数据来源。
- `subscription.channelId` 决定投递目标。
- `subscription` 是否能投递，取决于它的 delivery channel 当前有哪些可用 channel bindings。
- active `channel_binding` 必须有可用 `botPluginInstanceId`；suspended binding 可以保留旧 bot id 作为诊断和 takeover 依据。
- `notification_event` 应保存当次 fan-out 快照，不依赖当前 active join 才能展示历史。

## 2. 资源分类

### 2.1 业务资产

| 资源                 | Owner module                     | 语义                                                        |
| -------------------- | -------------------------------- | ----------------------------------------------------------- |
| `channel`            | `platform/core` 或 channel owner | Tori 内部逻辑空间，是通知和命令上下文                       |
| `subscription`       | `platform/subscription`          | owner 拥有、connection 提供数据、channel 负责投递的订阅规则 |
| `connection`         | `platform/connection`            | 用户 provider account 连接                                  |
| `user_binding`       | `platform/binding`               | Tori user 与外部 user 的逻辑绑定                            |
| `channel_binding`    | `platform/binding`               | Tori channel 与外部聊天室的逻辑绑定                         |
| `task_definition`    | `platform/task`                  | 任务定义                                                    |
| `notification_event` | `platform/notify`                | 通知历史                                                    |
| `task_run`           | `platform/task`                  | 执行历史                                                    |

业务资产默认保留。底层基础设施删除时，不得自下而上删除这些对象。

### 2.2 可替换基础设施

| 资源                             | Owner module                              | 语义                              |
| -------------------------------- | ----------------------------------------- | --------------------------------- |
| `bot_plugin_instance`            | `platform/bot-plugin`                     | 某个平台/namespace 的 bot runtime |
| `delivery_endpoint`              | `platform/bot-plugin` / `platform/notify` | bot runtime 的实际投递 endpoint   |
| `proxy_instance`                 | `platform/integration`                    | token-proxy 节点                  |
| `connection_credential`          | `platform/connection`                     | connection 当前访问凭证           |
| `token_proxy_connection_session` | `platform/connection`                     | 一次 external connect 临时会话    |

基础设施可以禁用、删除、替换。它们的生命周期不等于业务资产生命周期。

## 3. 表模型目标

### 3.1 Channel

```ts
type Channel = {
  id: string;
  type: string;
  name: string | null;
  status: "active" | "disabled" | "suspended";
  deletedAt: Date | null;
};
```

`channel` 是内部业务空间，不是外部聊天室。外部聊天室通过 `channel_binding` 映射进来。

### 3.2 Subscription

subscription 是独立配置实体，不等同于 channel 的子资源，也不等同于 user 的私有设置。

```ts
type Subscription = {
  id: string;
  ownerType: "user" | "channel";
  ownerId: string;
  channelId: string;
  connectionId: string | null;
  createdByUserId: string;
  topicType: string;
  topicKey: string;
  eventTypes: string[];
  status: "active" | "disabled" | "suspended";
  suspendedReason: string | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
};
```

三个核心维度：

- `ownerType + ownerId`：配置归属，决定谁能管理，以及 owner 被删除时如何处理。
- `connectionId`：数据源，决定从哪个 provider account 拉取或监听数据。
- `channelId`：投递目标，决定 notification fan-out 到哪个内部 channel。

禁止字段：

- `botPluginInstanceId`
- `deliveryPlatform`
- `deliveryNamespace`
- 固定外部 channel id

原因：

- subscription 是“某个 owner 基于某个 connection，把某类事件投递到某个 channel”，不是“通过哪个 bot 发到哪里”。
- 一个 delivery channel 可以同时绑定多个外部平台，subscription 不能被单个 bot 或单个外部平台锁死。

典型场景：

```txt
个人私聊订阅:
  ownerType = user
  ownerId = userId
  channelId = private channel
  connectionId = user's Steam connection

群组里的个人订阅:
  ownerType = user
  ownerId = userId
  channelId = group channel
  connectionId = user's Steam connection

群组公共订阅:
  ownerType = channel
  ownerId = group channel id
  channelId = group channel id
  connectionId = null or shared/public connection
```

生命周期规则：

- owner 是强生命周期依赖。`ownerType=user` 且 user 被删除时，subscription 应软删除或进入不可恢复终止状态；`ownerType=channel` 且 channel 被解散时同理。
- connection 是数据源依赖。connection 被 revoked/deleted/disabled 时，subscription 不应被删除，而应进入 `suspended`，reason 指向 `connection-unavailable`。
- channel 是投递目标依赖。channel 被 deleted 时，subscription 不能继续投递；如果 channel 是 owner，则 subscription 删除；如果 owner 是 user，则 subscription 可 `suspended` 并等待用户选择新的 delivery channel。
- channel binding/bot runtime 是投递通道依赖。它们不可用时，不删除也不直接 suspend subscription，失败体现在 delivery attempt 上，dashboard 可以展示 channel 的部分或全部出口不可用。

权限规则：

- `ownerType=user`：只有 owner user、管理员或被授权的代理人可以修改/删除该 subscription。即使它投递到 group channel，群内其他成员也不能修改。
- `ownerType=channel`：channel 管理员可以管理该 subscription；`createdByUserId` 是创建审计字段，不等同于永久 owner。
- `createdByUserId` 删除不必删除 channel-owned subscription，但应保留审计快照或转移管理权。

### 3.3 Channel Binding

channel binding 是内部 channel 到外部平台地址的映射。

```ts
type ChannelBinding = {
  id: string;
  channelId: string;
  platform: string;
  namespace: string;
  externalChannelId: string;
  externalChannelName: string | null;
  source: "bot-ingress" | "dashboard" | "system";
  assurance: "observed" | "verified" | "admin";
  status: "active" | "suspended" | "revoked";
  suspendedReason: string | null;
  endedAt: Date | null;
  deletedAt: Date | null;

  // 当前物理投递通道。active binding 必须非空；suspended binding 可保留旧值用于诊断。
  botPluginInstanceId: string | null;
  lastSeenBotPluginInstanceId: string | null;
};
```

唯一约束：

```sql
UNIQUE(platform, namespace, external_channel_id)
WHERE deleted_at IS NULL
```

`botPluginInstanceId` 的语义：

- 它不是 binding 的业务身份。
- 它表示“当前负责触达这个外部地址的物理 bot runtime”。
- 由于外部平台权限隔离，投递时必须校验这个具体 bot 是否 active。
- bot 删除时 binding 标记为 `suspended`，可以保留旧 id 作为历史依赖。
- 新 bot 上报同一个 `platform + namespace + externalChannelId` 且通过权限校验后，可以接管并替换为新 instance。

### 3.4 Bot Plugin Instance

```ts
type BotPluginInstance = {
  id: string;
  platform: string;
  namespace: string;
  name: string;
  endpointUrl: string;
  status: "active" | "disabled";
  deletedAt: Date | null;
};
```

同一 `platform + namespace` 可以有多个历史 instance。resolver 只使用 active 且未 deleted 的 instance。

### 3.5 Connection / Credential / Proxy

connection 也是业务资产，proxy 是可替换访问通道。

```ts
type Connection = {
  id: string;
  ownerUserId: string;
  provider: string;
  providerAccountId: string;
  providerAccountName: string | null;
  accessMode: "public-id" | "proxy-token" | "mixed";
  status: "active" | "disabled" | "suspended";
  suspendedReason: string | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
};

type ConnectionCredential = {
  id: string;
  connectionId: string;
  provider: string;
  proxyInstanceId: string | null;
  kind: "token-proxy-api-key" | "provider-refresh-token" | "provider-session";
  credentialRef: string;
  status: "active" | "disabled" | "expired" | "revoked";
  revokedReason: string | null;
  endedAt: Date | null;
  deletedAt: Date | null;
};
```

proxy instance 删除不会删除 connection，只会让 credential/connection 进入不可用状态。

## 4. Notification Fan-out 流程

### 4.1 正常投递

```txt
Business event
  -> match subscription by topic
  -> subscription.channelId
  -> load channel
  -> load channel_binding[] where channelId = subscription.channelId
  -> for each active binding:
       resolve bot runtime by binding.botPluginInstanceId
       send to externalChannelId
       record delivery attempt snapshot
```

fan-out 规则：

- 一个 subscription 只生成一个业务 notification event。
- delivery 层按 channel bindings 生成多次 delivery attempt。
- Telegram、Discord、Slack 等外部平台是 channel 的多个出口。

### 4.2 Binding 不可投递

如果某个 binding 找不到可用 bot runtime：

- 不删除 binding。
- 不删除 subscription。
- 当前 delivery attempt 标记 `failed`、`pending` 或 skipped。
- reason 使用 `bot-runtime-unavailable`。
- binding 可以进入 `suspended`，用于 dashboard 展示和自愈。

notification event 仍然保留，且记录：

```ts
type NotificationDeliveryAttemptSnapshot = {
  notificationEventId: string;
  channelId: string;
  channelBindingId: string;
  platform: string;
  namespace: string;
  externalChannelId: string;
  botPluginInstanceId: string | null;
  deliveryEndpointId: string | null;
  status: "sent" | "failed" | "pending" | "skipped";
  reason: string | null;
};
```

## 5. Bot Plugin 生命周期

### 5.1 删除 bot instance

bot instance 是快递员，不是用户的收件地址，也不是订报计划。

执行：

```txt
DELETE bot_plugin_instance
  -> bot_plugin_instance.deletedAt = now
  -> emit platform.bot-instance.deleted
```

binding module 监听：

```txt
platform.bot-instance.deleted
  -> find channel_binding where botPluginInstanceId = deleted id and deletedAt IS NULL
  -> keep botPluginInstanceId as the last failed runtime pointer
  -> set status = suspended
  -> set suspendedReason = bot-instance-deleted
```

禁止：

- 删除 channel。
- 删除 channel_binding。
- revoke channel_binding。
- 删除 subscription。
- disable subscription。

subscription module 不需要直接感知 bot 生死。它只关心 owner、channel 和 connection 是否仍是有效业务配置。投递失败或跳过由 notify fan-out/runtime resolver 处理。

### 5.2 禁用 bot instance

执行：

```txt
bot_plugin_instance.status = disabled
emit platform.bot-instance.disabled
```

binding module 可以把绑定到该 instance 的 binding 标记为 `suspended`：

```txt
channel_binding.status = suspended
channel_binding.suspendedReason = bot-instance-disabled
```

如果用户重新 enable 该 bot instance，binding 可以恢复 `active`。

### 5.3 新 bot 自动接管旧 binding（Takeover / Self-Healing）

bot ingress 收到新 instance 的消息时：

```txt
bot instance B reports:
  platform = telegram
  namespace = managed
  externalChannelId = chat_123
```

解析：

```txt
find channel_binding
  where platform = telegram
    and namespace = managed
    and externalChannelId = chat_123
    and deletedAt IS NULL
```

如果找到：

- 不创建新 channel。
- 不创建新 subscription。
- 校验触发 takeover 的用户对该 channel/binding 有恢复权限。
- 更新 `botPluginInstanceId = B`。
- 更新 `lastSeenBotPluginInstanceId = B`。
- 如果 status 是 `suspended` 且没有人工 revoke，则恢复 `active`。

如果找不到：

- 按现有 bot-ingress 逻辑创建 channel 和 channel_binding。

完整自愈流程：

```txt
old bot A deleted
  -> channel_binding.status = suspended
  -> notifications skip/fail only this binding
  -> subscription stays unchanged

new bot B created
  -> user adds B to the same external channel
  -> any command or status message reaches bot ingress
  -> ingress finds suspended binding by platform + namespace + externalChannelId
  -> permission check passes
  -> binding.botPluginInstanceId = B
  -> binding.status = active
  -> all existing subscriptions targeting the channel resume fan-out through this binding
```

## 6. Bot Ingress 协议

bot plugin 调用 Tori 时，`botPluginInstanceId` 用于认证和诊断，不用于决定业务归属。

```ts
type BotIngressRequest = {
  platform: string;
  namespace: string;
  botPluginInstanceId: string;
  externalMessageId: string;
  externalUser: {
    id: string;
    username?: string;
    displayName?: string;
  };
  externalChannel: {
    id: string;
    name?: string;
    type?: string;
  };
  command: {
    name: string;
    args: string[];
    rawText: string;
  };
};
```

解析顺序：

1. 认证 `botPluginInstanceId`，确认 instance active 且未 deleted。
2. 使用 `platform + namespace + externalUser.id` 查找或创建 `user_binding`。
3. 使用 `platform + namespace + externalChannel.id` 查找 `channel_binding`。
4. 如果 binding 已存在，更新当前 runtime 指针到该 bot instance。
5. 如果 binding 不存在，创建 Tori channel 和 channel_binding。
6. command handler 只使用解析出的 Tori user/channel。

这个流程保证换 bot 后，旧 channel 和旧 subscription 可以被新 bot 接管。

## 7. Proxy / Token-Proxy 生命周期

### 7.1 Proxy 删除

proxy instance 是 provider access 通道，不是 connection 的业务身份。

执行：

```txt
DELETE proxy_instance
  -> proxy_instance.deletedAt = now
  -> emit platform.proxy-instance.deleted
```

connection module 监听：

```txt
platform.proxy-instance.deleted
  -> find connection_credential where proxyInstanceId = deleted id
  -> credential.status = disabled or revoked
  -> connection.status = suspended
  -> connection.suspendedReason = proxy-instance-unavailable
```

禁止：

- 删除 connection。
- 删除 subscription。
- 删除 task_definition。

subscription/task 是否暂停由它们自己的 owner module 根据 connection event 处理。

### 7.2 Token-proxy external connect

```txt
Tori Web
  -> POST /api/platform/connections/token-proxy/sessions
  -> Tori creates token_proxy_connection_session
  -> popup opens token-proxy external connect URL
  -> token-proxy authenticates provider account
  -> user selects account
  -> token-proxy redirects to Tori callback with code/state
  -> Tori exchanges code
  -> upsert connection by ownerUserId + provider + providerAccountId
  -> replace/create connection_credential
```

session create:

```ts
type CreateTokenProxyConnectionSessionRequest = {
  proxyInstanceId: string;
  provider: string;
  ownerUserId: string;
  returnTo: string;
};

type CreateTokenProxyConnectionSessionResponse = {
  sessionId: string;
  state: string;
  externalConnectUrl: string;
  expiresAt: string;
};
```

callback exchange 必须一次性消费：

```sql
UPDATE token_proxy_connection_session
SET status = 'exchanging', updated_at = now()
WHERE id = :sessionId
  AND state = :state
  AND status = 'pending'
  AND expires_at > now()
  AND deleted_at IS NULL
RETURNING *;
```

如果 callback 重放：

- 已 completed：返回已保存 result。
- pending 不存在：返回 `already-consumed` 或 `expired`。
- exchanging 超时：按后台补偿或失败策略处理。

### 7.3 Proxy 替换恢复

```txt
old proxy deleted
  -> connection suspended
  -> subscription/task runtime stops because connection resolver fails

new proxy registered
  -> user runs token-proxy connect/rebind
  -> provider account matches existing connection
  -> new credential replaces old credential
  -> connection restored active
  -> subscription/task can run again
```

connection id 不变，subscription 不需要重建。

## 8. Action Check 边界

destructive action 需要 check，但 check 只说明直接影响、降级语义和恢复路径，不递归模拟所有 MQ 副作用。

```txt
POST /api/<module>/<resource>/:id/lifecycle/check
```

实际副作用必须通过 command 写入当前资源状态和 outbox event，再由 owner module consumer 异步完成挂起或恢复。HTTP action 不应同步扫描和更新完整下游图。

删除 bot instance 的 check 应表达：

```json
{
  "summary": "This bot runtime will be removed. Channel bindings and subscriptions are retained. Bindings currently using this bot will be suspended until a replacement bot reports the same platform/namespace/channel.",
  "affected": [
    {
      "type": "channel_binding",
      "action": "suspend",
      "reason": "These external channel addresses keep existing but lose their current physical bot carrier."
    }
  ],
  "retained": [
    { "type": "channel", "action": "retain" },
    { "type": "subscription", "action": "retain" },
    { "type": "notification_event", "action": "retain" }
  ],
  "runtimeEffects": [
    "Future deliveries to suspended bindings will be skipped, fail, or stay pending until a replacement bot is attached."
  ]
}
```

错误提示示例：

```txt
Deleting this bot will permanently delete 5 channels and 12 subscriptions.
```

正确提示示例：

```txt
Deleting this bot will suspend delivery for 5 external channel bindings. The 12 subscriptions targeting those channels are retained and can resume after a replacement bot takes over the bindings.
```

删除 proxy instance 的 check 应表达：

```json
{
  "summary": "This proxy instance will be removed. Connections are retained but credentials using this proxy become unavailable.",
  "affected": [
    {
      "type": "connection",
      "action": "suspend",
      "reason": "Connections using credentials from this proxy cannot access provider APIs until rebind."
    }
  ],
  "retained": [
    { "type": "subscription", "action": "retain" },
    { "type": "task_definition", "action": "retain" },
    { "type": "task_run", "action": "retain" }
  ]
}
```

## 9. Runtime Resolver

### 9.1 Notification route resolver

输入：

```ts
type ResolveChannelDeliveryRoutesInput = {
  channelId: string;
};
```

输出：

```ts
type ResolveChannelDeliveryRoutesResult = {
  routes: Array<
    | {
        ok: true;
        channelBindingId: string;
        platform: string;
        namespace: string;
        externalChannelId: string;
        botPluginInstanceId: string;
        deliveryEndpointId: string;
      }
    | {
        ok: false;
        channelBindingId: string;
        platform: string;
        namespace: string;
        externalChannelId: string;
        reason:
          | "binding-inactive"
          | "binding-suspended"
          | "bot-runtime-unavailable"
          | "delivery-endpoint-unavailable";
      }
  >;
};
```

查询规则：

- `channel.deletedAt IS NULL`
- `channel.status = active`
- `channel_binding.deletedAt IS NULL`
- `channel_binding.status IN ('active', 'suspended')`
- active binding 才尝试投递
- suspended binding 生成 skipped/failed/pending attempt，不影响其他 binding fan-out

### 9.2 Connection access resolver

输入：

```ts
type ResolveConnectionAccessInput = {
  connectionId: string;
  ownerUserId: string;
  provider: string;
};
```

输出：

```ts
type ResolveConnectionAccessResult =
  | {
      ok: true;
      connectionId: string;
      credentialId: string;
      credentialRef: string;
      proxyInstanceId: string | null;
      accessMode: "public-id" | "proxy-token" | "mixed";
    }
  | {
      ok: false;
      reason:
        | "connection-not-found"
        | "connection-inactive"
        | "credential-unavailable"
        | "proxy-instance-unavailable";
    };
```

查询规则：

- `connection.deletedAt IS NULL`
- `connection.status = active`
- `connection_credential.deletedAt IS NULL`
- `connection_credential.status = active`
- 如果 credential 依赖 proxy，则 `proxy_instance.deletedAt IS NULL` 且 `proxy_instance.status = active`

## 10. 事件协议

事件归 owner module，不建立独立 lifecycle module。

### 10.1 Bot events

Owner: `platform/bot-plugin`

```ts
type BotInstanceDeleted = {
  type: "platform.bot-instance.deleted";
  payload: {
    botInstanceId: string;
    platform: string;
    namespace: string;
    occurredAt: string;
  };
};

type BotInstanceRegistered = {
  type: "platform.bot-instance.registered";
  payload: {
    botInstanceId: string;
    platform: string;
    namespace: string;
    occurredAt: string;
  };
};
```

Consumers:

- binding module：挂起或恢复 channel_binding 的 runtime 指针。
- notify module：失效 route cache。

subscription module 不监听 bot instance 事件。

### 10.2 Binding events

Owner: `platform/binding`

```ts
type ChannelBindingSuspended = {
  type: "platform.channel-binding.suspended";
  payload: {
    channelBindingId: string;
    channelId: string;
    platform: string;
    namespace: string;
    externalChannelId: string;
    reason: string;
    occurredAt: string;
  };
};

type ChannelBindingRestored = {
  type: "platform.channel-binding.restored";
  payload: {
    channelBindingId: string;
    channelId: string;
    botPluginInstanceId: string;
    occurredAt: string;
  };
};
```

Consumers:

- notify module：失效 channel route cache。
- dashboard stream：刷新 binding 状态。

### 10.3 Proxy / Connection events

Owner: `platform/integration` and `platform/connection`

```ts
type ProxyInstanceDeleted = {
  type: "platform.proxy-instance.deleted";
  payload: {
    proxyInstanceId: string;
    occurredAt: string;
  };
};

type ConnectionSuspended = {
  type: "platform.connection.suspended";
  payload: {
    connectionId: string;
    provider: string;
    reason: string;
    occurredAt: string;
  };
};

type ConnectionRestored = {
  type: "platform.connection.restored";
  payload: {
    connectionId: string;
    provider: string;
    occurredAt: string;
  };
};
```

Consumers:

- subscription/task owner module 根据 connection state 决定是否暂停运行。
- notify/task runtime resolver 仍必须执行时校验。

## 11. 删除与禁用策略

### 11.1 Bot Plugin Instance

Delete:

- bot 写 `deletedAt`。
- binding 保留指向旧 bot 的诊断指针，binding 进入 `suspended`。
- channel/subscription 不变。

Disable:

- bot `status = disabled`。
- binding 可以进入 `suspended`。
- enable 后 binding 可恢复。

### 11.2 Channel Binding

Delete:

- `deletedAt = now`。
- 表示用户删除一个外部收件地址。
- subscription 不变，因为 channel 仍然存在。

Revoke:

- `status = revoked`，`endedAt = now`。
- 表示这个外部地址绑定关系明确终止。

Suspend:

- runtime 不可用导致。
- 不是用户删除，不影响业务资产。
- 当前统一落到 `suspended` 状态；`suspendedReason` 区分 bot deleted、bot disabled、permission lost 等原因。

### 11.3 Subscription

Delete:

- `deletedAt = now`。
- 这是删除订阅规则本身。
- owner 被删除时，subscription 才跟随 owner 软删除或终止。

Disable:

- `status = disabled`。
- 用户暂时关闭订阅。

Suspend:

- connection 等上游业务依赖不可用。
- delivery channel 不可用时，按 owner 关系决定：如果 owner 也是该 channel，通常可 deleted/terminated；如果 owner 是 user，则通常 suspended 并要求用户选择新 channel。
- bot binding 不可用通常不 suspend subscription，因为 subscription 仍然对 channel 有效；失败发生在 delivery attempt。

### 11.4 Connection

Delete:

- `deletedAt = now`。
- 订阅引用该 connection 时不能继续运行，可由 subscription module 标记 `suspended`。

Disable:

- 用户主动停用 provider account。

Suspend:

- proxy/credential 不可用。

### 11.5 User / Channel 作为 Owner

User 删除：

- 该 user 拥有的 connection 进入 deleted/revoked。
- `ownerType=user` 且 `ownerId=userId` 的 subscription 写 `deletedAt` 或进入不可恢复终止状态。
- 投递到其他 group channel 的 user-owned subscription 也按 owner 生命周期处理。
- channel-owned subscription 不因 `createdByUserId` 删除而删除。

Channel 解散：

- channel 写 `deletedAt`。
- 该 channel 的 channel_binding 写 `deletedAt`。
- `ownerType=channel` 且 `ownerId=channelId` 的 subscription 写 `deletedAt`。
- `ownerType=user` 但 `channelId=deleted channel` 的 subscription 进入 `suspended`，等待用户选择新的 delivery channel，除非产品策略要求随 channel 删除。

## 12. 迁移计划

### Phase 1: 修正 subscription 模型

1. 从目标模型中移除 subscription 的 `botPluginInstanceId`。
2. 不引入 `deliveryPlatform/deliveryNamespace` 到 subscription。
3. 确认 subscription 显式包含 `ownerType + ownerId`、`connectionId`、`channelId`、topic/event rule。
4. 明确 user-owned group subscription 与 channel-owned public subscription 的权限差异。
5. 更新 API/DTO，避免前端创建 subscription 时选择 bot instance。

### Phase 2: 重定义 channel binding

1. `channel_binding` 保留 `platform`、`namespace`、`externalChannelId`。
2. `botPluginInstanceId` 作为物理投递 runtime 指针；active binding 必须可解析到 active bot。
3. 增加或确认 `suspended` 状态和 reason 字段。
4. bot 删除时只挂起 binding，不 revoke/delete binding，不影响 subscription。

### Phase 3: 修改 bot ingress

1. 按 `platform + namespace + externalChannelId` 查找已有 binding。
2. 找到旧 binding 时更新 `botPluginInstanceId` 为当前 instance。
3. 如果旧 binding 是 suspended，恢复 active。
4. 只有找不到 binding 时才创建新 channel。

### Phase 4: 修改 notification fan-out

1. notification event 按 subscription 得到 channel。
2. notify route resolver 读取 channel 的全部 channel bindings。
3. 每个 binding 生成 delivery attempt。
4. 单个 binding 失败不影响其他 binding。
5. delivery attempt 保存 platform/namespace/externalChannelId/botPluginInstanceId 快照。

### Phase 5: Proxy 与 connection 恢复

1. proxy 删除只影响 credential。
2. connection 保留并进入 suspended。
3. token-proxy rebind 按 provider account 匹配旧 connection。
4. 替换 credential 后恢复 connection。

## 13. 非目标

本设计不要求：

- 新增独立 lifecycle module。
- 把 Tori 拆成微服务。
- 在 action-check 中递归模拟所有 MQ 副作用。
- 因 bot 删除而清空用户业务配置。
- 因 proxy 删除而清空 provider account connection。

## 14. 最终原则

- Subscription 是 owner、connection、channel 的三方配置契约。
- Channel 是投递中枢。
- Subscription 投递到 Channel，但不必属于 Channel。
- Channel Binding 是外部收件地址，不是 Bot 的子资源。
- Bot Plugin Instance 是可替换快递员。
- Proxy Instance 是可替换访问通道。
- 底层基础设施删除，最多让上层业务资产 suspended，或让单条 delivery attempt failed/skipped。
- 用户配置资产必须保留，等待新 runtime 接入后恢复。
