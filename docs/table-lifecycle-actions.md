# Dashboard Resource Lifecycle Protocol

本文档定义 Dashboard 中删除、禁用、撤销类操作的业务协议。目标不是强一致性控制台，而是适合当前 Tori 规模和 MQ 架构的轻量生命周期模型。

核心原则：

- 用户操作前需要知道大致影响，因此 destructive action 前必须有 `check`。
- `check` 只做轻量影响说明和必要统计，不做深层同步级联计算。
- 实际 action 只同步修改主资源、必要的安全状态，并写入 lifecycle/outbox event。
- 下游资源清理通过 MQ consumer 异步完成。
- 所有 runtime 入口必须做依赖校验；如果上游不可用，运行时 fail-fast，并把自身标记为 disabled/error。

## API 形态

每个支持 `disable`、`delete`、`revoke` 的资源提供一个检查接口和一个实际操作接口。

```text
POST /api/<module>/<resource>/:id/lifecycle/check
POST /api/<module>/<resource>/:id/disable
DELETE /api/<module>/<resource>/:id
POST /api/<module>/<resource>/:id/revoke
```

`check` 请求：

```ts
type LifecycleCheckRequest = {
  action: "disable" | "enable" | "delete" | "revoke";
};
```

`check` 响应：

```ts
type LifecycleCheckResponse = {
  resource: {
    type: string;
    id: string;
    label: string | null;
    currentStatus: string | null;
  };
  action: "disable" | "enable" | "delete" | "revoke";
  allowed: boolean;
  severity: "info" | "warning" | "danger";
  summary: string;
  blocking: LifecycleImpactItem[];
  affected: LifecycleImpactItem[];
  asyncEffects: LifecycleImpactItem[];
  retained: LifecycleImpactItem[];
  internalCleanup: LifecycleImpactItem[];
  runtimeEffects: string[];
  warnings: string[];
};

type LifecycleImpactItem = {
  type: string;
  count?: number;
  sample?: Array<{ id: string; label: string | null }>;
  action:
    | "none"
    | "disable"
    | "delete"
    | "revoke"
    | "retain"
    | "internal-cleanup"
    | "manual-required"
    | "async-disable"
    | "async-cleanup";
  reason: string;
};
```

`check` 的职责是让用户知道影响，不是生成精确执行计划。实现上可以返回粗粒度 count 和少量 sample；不要为了展示弹窗写复杂多层 join。

实际 action API 必须在执行时重新校验关键阻塞条件。`check` 不是授权 token，也不替代 action 的业务校验。

## 状态语义

### Disable

禁用是可查询、可恢复的运行时停止操作。

- DB 记录保留。
- 管理列表可以看到 disabled 对象。
- runtime 入口必须排除 disabled 对象。
- action 同步更新当前资源状态并写 outbox。
- 下游 disable 由 MQ consumer 异步处理。

### Delete

Dashboard 的普通 `Delete` 是软删除。

- DB 记录保留。
- 普通列表和业务 resolver 不返回 deleted 对象。
- 历史、诊断、管理员视图可以看到 deleted 对象。
- action 同步写 `status=deleted` 或等价字段，并写 outbox。
- 唯一约束必须允许 deleted 对象不阻塞重新创建。

### Revoke

撤销用于绑定、授权、runtime credential 等关系终止。

- DB 记录保留。
- 普通 active 查询不返回 revoked 对象。
- 写入 `endedAt`、`revokedReason` 或等价 metadata。
- action 同步更新当前关系，并写 outbox。

### Internal Cleanup

内部清理可以物理删除 DB 记录，但不作为普通 Dashboard delete 的默认语义。

适用对象：

- credential secret / credential reference
- token-proxy connection session
- expired claim/session 临时对象
- Steam account / family / library cache
- 超过保留期的历史/tombstone

如果某个 Dashboard action 会触发内部清理，`check` 必须明确提示。

### Retain

以下对象默认保留，不随上游 delete 硬删：

- notification event
- task run
- claim session
- lifecycle/outbox event

这些历史表应保存必要 snapshot，不能依赖 join 已删除业务表才能看懂。

## Check 实现约束

`check` 应该轻量。

允许：

- 返回固定业务说明。
- 查询一层直接依赖的 count。
- 返回最多几条 sample，帮助用户识别影响对象。
- 返回需要用户先处理的 blocking 条件。

避免：

- 为了弹窗递归扫描全系统依赖。
- 在 `check` 中计算完整级联执行计划。
- 让前端依赖精确 count 才能继续操作。

示例：disable connection 的 check 可以返回：

- affected: active subscriptions count
- affected: enabled task definitions count
- retained: notification events retained
- asyncEffects: related subscriptions and task definitions will be disabled by background lifecycle worker
- runtimeEffects: Steam sync and token access stop immediately because runtime resolver checks connection status

## Action 实现约束

实际 action 的同步事务只包含：

- 当前资源状态更新。
- 必要的安全状态更新，例如 credential 立即禁用。
- lifecycle/outbox event 写入。
- action 执行时的关键阻塞条件复查。

不要在同步 action 事务里做大范围下游级联。级联逻辑由 MQ consumer 处理。

推荐事件：

```ts
type LifecycleEvent =
  | { type: "proxy.disabled"; proxyInstanceId: string }
  | { type: "proxy.deleted"; proxyInstanceId: string }
  | { type: "connection.disabled"; connectionId: string }
  | { type: "connection.deleted"; connectionId: string }
  | { type: "binding.revoked"; bindingType: "user" | "channel"; bindingId: string }
  | { type: "subscription.disabled"; subscriptionId: string }
  | { type: "subscription.deleted"; subscriptionId: string }
  | { type: "task_definition.disabled"; taskDefinitionId: string }
  | { type: "task_definition.deleted"; taskDefinitionId: string }
  | { type: "bot_instance.disabled"; botInstanceId: string }
  | { type: "bot_instance.deleted"; botInstanceId: string };
```

MQ consumer 必须幂等。重复消费同一个 lifecycle event 不应造成错误。

## Runtime 兜底

不能假设 MQ 级联已经完成。所有运行时入口都要检查整条依赖链。

必须检查：

- subscription matching: subscription、connection、proxy、channel binding、bot instance、delivery endpoint 都必须可用。
- task scanner: task definition 必须 enabled，绑定的 connection/provider dependency 必须可用。
- task runner: 执行前重新读取 definition 和上游资源；不可用时取消或失败当前 run，并标记 definition/subscription disabled/error。
- bot ingress: bot instance、runtime credential、channel binding 必须 active。
- token-proxy connection: proxy instance 必须 active。

运行时发现上游缺失或 disabled 时：

- 当前执行 fail-fast。
- 写入明确 error reason。
- 必要时把自身标记为 disabled/error。
- 发出 lifecycle event，让 Dashboard 后续展示原因。

## 资源策略

### Proxy Instance

业务含义：外部 token-proxy 服务实例，是 proxy-token connection credential 的上游依赖。

Disable：

- 同步：`proxy_instance.status = disabled`，写 `proxy.disabled` event。
- 可同步安全处理：禁用直接 credential access。
- 异步：consumer 禁用该 proxy 下 active connections、相关 subscriptions、相关 task definitions。
- 运行时：token-proxy connect 和 provider access resolver 必须立即排除 disabled proxy。

Delete：

- Dashboard delete 为软删除：`proxy_instance.status = deleted`。
- 如果仍有 active connections，check 应提示用户先处理；action 可选择阻止，避免静默删除账号授权的上游。
- 内部清理：未完成 token-proxy sessions 可清理。
- 历史保留：connections、subscriptions、notification events、task runs。

### Connection

业务含义：用户连接到外部 provider 的账号身份。

Disable：

- 同步：`connection.status = disabled`，禁用 active credential，写 `connection.disabled` event。
- 异步：consumer 禁用相关 subscriptions、task definitions，取消 pending task runs。
- 运行时：Steam access resolver、subscription matching、task runner 必须立即排除 disabled connection。

Delete：

- Dashboard delete 为软删除：`connection.status = deleted`。
- 同步：删除或失效 credential reference，写 `connection.deleted` event。
- 内部清理：token-proxy sessions、Steam account/family/library cache。
- 异步：consumer 禁用或删除相关 subscriptions/task definitions。
- 保留：notification events、task runs。

### User Binding

业务含义：平台用户和外部 provider identity 的绑定关系。

操作是 revoke，不是 delete。

- 同步：`user_binding.status = revoked`，写 ended/reason，写 `binding.revoked` event。
- 不级联删除 connection。
- claim session 和历史记录保留。

### Channel Binding

业务含义：外部 channel 的投递绑定关系。

操作是 revoke，不是 delete。

- 同步：`channel_binding.status = revoked`，写 ended/reason，写 `binding.revoked` event。
- 异步：consumer 禁用该 channel 下 active subscriptions。
- 运行时：notification delivery 和 bot ingress 必须排除 revoked channel binding。
- notification events 保留。

### Subscription

业务含义：用户希望持续接收某类事件通知的规则。

Disable：

- 同步：`subscription.status = disabled`，写 `subscription.disabled` event。
- notification events 保留。

Enable：

- action 前必须校验 connection、channel binding、bot instance、delivery endpoint、provider dependency 都可用。
- 校验通过后写 `subscription.status = active` 和 lifecycle event。

Delete：

- Dashboard delete 为软删除：`subscription.status = deleted`。
- notification events 保留。
- 相关 task definition 由 MQ consumer disable/delete。

### Task Definition

业务含义：可重复调度的后台工作定义。

Disable：

- 同步：`task_definition.enabled = false`，写 `task_definition.disabled` event。
- 异步：consumer 取消 pending task runs。
- running task runs 不强杀；runner 在检查点停止或自然失败。

Delete：

- Dashboard delete 为软删除：标记 deleted 或 disabled+deleted metadata。
- task runs 保留。
- 内部清理只由 retention job 执行。

### Bot Instance / Bot Runtime

业务含义：可投递消息的 bot 运行实例，拥有 runtime credential、delivery endpoint、channel bindings。

Disable：

- 同步：`bot_plugin_instance.status = disabled`，写 `bot_instance.disabled` event。
- runtime credential auth 必须立即不通过。
- notification candidate generation 必须检查 bot instance status。
- 是否异步禁用 subscriptions 由 consumer 策略决定；无论是否禁用，runtime delivery 必须立即阻断 disabled bot。

Delete：

- Dashboard delete 为软删除或 revoke，不硬删 bot instance。
- 同步：bot instance 标记 deleted/revoked，runtime credential 失效，写 `bot_instance.deleted` event。
- 异步：consumer revoke channel bindings、disable subscriptions、disable delivery endpoint。
- 保留：notification events、task runs、channel binding history。

### Delivery Endpoint

业务含义：通知投递目标。

- disable endpoint 会停止投递。
- delete endpoint 为软删除。
- bot delete 可以通过 MQ consumer 异步 disable 独占 endpoint。
- notification events 保留。

### Claim Session

业务含义：绑定流程历史和诊断对象。

- 不提供普通删除。
- 只通过流程状态更新。
- 过期后由 retention job 内部清理。

### Notification Event

业务含义：投递历史、排障证据和审计记录。

- 不提供用户级删除。
- 不随 connection / subscription / bot delete 硬删。
- 写入必要 snapshot，避免依赖已删除业务表 join。

### Token Proxy Connection Session

业务含义：临时外部连接流程状态。

- pending / failed / expired session 可以内部清理。
- completed session 可短期保留后清理。
- connection delete 可以清理对应 session，但不能删除 notification/task 历史。

### Steam Cache Tables

业务含义：从 Steam 派生的可再生缓存。

connection delete 后可以内部清理：

- account profile cache
- user library cache
- family cache
- family member cache
- family library cache

connection disable 不删除 cache，只让 runtime resolver 不再使用该 connection。

## 查询语义

管理列表：

- 可以返回 active、disabled、deleted、revoked 对象，但必须显示 status。
- 默认 tab 可以只展示 active/disabled，历史 tab 展示 deleted/revoked。

普通业务 resolver：

- 只返回 active/enabled 对象。
- 不返回 disabled、deleted、revoked 对象。

运行时 resolver：

- 必须检查完整依赖链。
- 不依赖 MQ 级联已经完成。
- 发现上游不可用时 fail-fast，并写入明确 lifecycle reason。

历史查询：

- notification event、task run、claim session 默认保留。
- 历史展示优先用 snapshot，不依赖 join 当前 active 业务表。

## 当前实现偏差

后续实现需要修正：

- bot instance disable 后，notify candidate generation 仍可能使用 disabled bot。
- subscription enable 先写 active 再校验 connection，失败时会留下错误状态。
- proxy / connection / bot / task 的 delete 当前包含过多同步 hard delete。
- notification event 和 task run 不应该被上游 delete 硬删。
- task definition delete 当前硬删 task runs，应该改为软删除 definition 并保留 runs。
- channel/user binding UI 不应叫 Remove，应叫 Revoke。
- subscription UI 不应叫 Remove，应叫 Disable 或 Pause。
- 多表同步级联应改为 outbox/MQ consumer 异步处理。
