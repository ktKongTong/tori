# Subscription Design

本文档描述 Tori notification subscription module 拥有的 subscription，以及 subscription 对 notification event 和派生 task definition 的关系。

资源生命周期命令边界见 [../constraint/resource-lifecycle.md](../constraint/resource-lifecycle.md)。

## Resources

### `subscription`

由 owner 拥有、基于 connection 取数、向 channel 投递的配置实体。

关系：

- `ownerType` + `ownerId` 决定谁拥有这条订阅。
- `connectionId` 决定数据源。
- `channelId` 决定投递目标。
- `topicType` + `topicKey` + `eventTypes` 决定订阅目标。
- subscription 不绑定 bot instance。

状态：

- active subscription 可参与业务任务和通知。
- disabled subscription 不再生成或执行派生业务任务。
- deleted subscription 普通查询不可见，不再产生业务任务或通知。

#### Subscription Target

Subscription target 由三部分组成：

- `topicType`：目标类型，例如 provider account、family、project、resource collection。
- `topicKey`：目标实例 key。没有细分实例时可以为空。
- `eventTypes`：该 target 下订阅的业务事件类型。

Provider-specific target 由 provider adapter 定义，但 subscription module 负责保存 normalized target，并保证 Dashboard 不要求用户理解内部 key。

同一 subscription identity 至少包含：

- `channelId`
- `connectionId`
- `ownerType`
- `ownerId`
- `topicType`
- `topicKey`

`eventTypes` 是该 identity 下的订阅内容。更新 eventTypes 不应创建另一条重复 subscription，除非 owner module 明确需要按 event type 拆分。

### `notification_event`

一次业务事件投递尝试和结果记录。

关系：

- `subscriptionId` 记录来源订阅。
- `channelId`、`channelBindingId` 记录投递目标。
- `botPluginInstanceId`、`deliveryEndpointId` 记录实际投递线路。
- event id、event type、delivery id 记录跨 Bot Delivery 的关联信息。

状态：

- sent 记录成功投递时间。
- failed 记录失败时间和错误。
- notification event 作为历史记录保留。

## Operations

| Operation                  | Resource             | Preconditions                                                                 | Result / Side effect                                                        |
| -------------------------- | -------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| create subscription        | `subscription`       | user authenticated; connection active and visible; channel has active binding | creates or returns existing subscription; emits `SubscriptionCreated`       |
| update subscription status | `subscription`       | owner/admin; target subscription visible                                      | active emits `SubscriptionActivated`; disabled emits `SubscriptionDisabled` |
| update event types         | `subscription`       | owner/admin; identity unchanged                                               | updates subscribed eventTypes without creating duplicate subscription       |
| delete subscription        | `subscription`       | owner/admin                                                                   | soft deletes subscription; emits `SubscriptionDeleted`                      |
| record notification result | `notification_event` | delivery attempt has result                                                   | stores normalized sent/failed result                                        |

创建规则：

- `ownerType = USER` 时，`ownerId = ctx.userId`。
- `ownerType = CHANNEL` 时，`ownerId = channelId`。
- 同一 `channelId + connectionId + ownerType + ownerId + topicType + topicKey` 视为 subscription identity；已存在则返回 existing。

## Query Boundary

- 普通用户只能查询自己可访问的 subscription。
- admin 可以查询全部 subscription。
- notification event 查询必须先确认当前用户可访问对应 subscription。

## Derived Task Definition

Subscription module 拥有从 subscription 到 task definition 的派生规则。

派生规则输入：

- subscription id。
- connection id。
- topicType/topicKey。
- eventTypes。
- provider capability。

派生 task definition 必须写入 metadata：

- `source = "platform.subscription"`。
- `subscriptionId`。
- `subscriptionTaskDefinitionId`。
- provider/topic 摘要。

Task module 只保存和执行 task definition，不解释 provider subscription target。

## Notification Routing

Notification routing 从 subscription 出发解析投递线路：

```txt
subscription
  -> channel
  -> active channel binding
  -> active bot instance
  -> active delivery endpoint
  -> Bot Delivery
```

如果没有 active channel binding、bot instance 或 delivery endpoint，notification event 记录 failed，并给出可恢复错误摘要。

## Lifecycle Effects

- created 时发出 `SubscriptionCreated`，创建派生 task definition。
- active 时发出 `SubscriptionActivated`，恢复派生 task definition。
- disabled 时发出 `SubscriptionDisabled`，禁用派生 task definition 并取消 pending task run。
- deleted 时发出 `SubscriptionDeleted`，删除或禁用派生 task definition，并取消 pending task run。
- connection disabled/deleted 会禁用依赖该 connection 的 active subscription。
- proxy instance disabled/deleted 会通过 connection 继续影响 subscription。

Lifecycle event 语义见 [../constraint/lifecycle-events.md](../constraint/lifecycle-events.md)。
