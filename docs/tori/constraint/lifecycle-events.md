# Lifecycle Events Constraint

本文档定义 Tori 内部 owner module 之间的 lifecycle event 语义。

Lifecycle event 是 Tori 内部模块事件，不属于跨 Tori、Tori Proxy、Bot、Browser 的 protocol design。

## Principles

- 拥有资源的 owner module 发出 lifecycle event。
- 被影响资源的 owner module 消费 event 并决定如何处理自己的资源。
- Event 只描述已经发生的事实，不定义上游资源支持哪些命令。
- 不做自下而上的毁灭性级联删除。
- 基础设施失效通常导致业务资源 suspended/disabled，而不是物理删除。
- Runtime handler 必须在执行前校验自身需要的依赖状态，不能只依赖异步级联已经完成。

## Event Ownership

| Resource       | Owner module                          | Event names                                                                                   |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| bot instance   | `platform/bot-plugin`                 | `BotInstanceDisabled`, `BotInstanceDeleted`                                                   |
| connection     | `platform/integration/connection`     | `ConnectionDisabled`, `ConnectionDeleted`                                                     |
| proxy instance | `platform/integration/proxy-instance` | `ProxyInstanceDisabled`, `ProxyInstanceDeleted`                                               |
| subscription   | `platform/notification/subscription`  | `SubscriptionCreated`, `SubscriptionActivated`, `SubscriptionDisabled`, `SubscriptionDeleted` |
| task run       | `platform/task`                       | `TaskRunRequested`                                                                            |

## Event Payload

Lifecycle event payload 必须包含：

- `eventId`
- `eventName`
- `occurredAt`
- `resourceType`
- `resourceId`
- `ownerModule`
- `causationId`
- `correlationId`

影响下游处理所需的最小业务字段可以进入 payload，例如 connection id、subscription id、task definition id。Payload 不应包含 provider token、runtime credential 或 delivery endpoint secret。

## Bot Instance Lifecycle

Bot instance 是可信基础设施。

当 bot instance disabled/deleted：

- bot instance owner module 发出 lifecycle event。
- binding owner module 消费事件。
- 关联 channel binding 进入 suspended，或保持 deleted 状态。
- subscription 不删除。
- channel 不删除。

## Connection Lifecycle

Connection 是用户 provider account 数据源。

当 connection disabled：

- connection owner module 发出 lifecycle event。
- subscription owner module 禁用依赖该 connection 的 active subscription。
- 每个被禁用 subscription 继续走 subscription disabled lifecycle。

当 connection deleted：

- connection owner module 发出 lifecycle event。
- connection owner module 清理 connection credential。
- connection owner module 清理 token-proxy connection session。
- subscription owner module 禁用依赖该 connection 的 active subscription。

Provider access resolver 必须在使用 connection 前校验状态，不能只依赖异步 consumer 已经完成。

## Proxy Instance Lifecycle

Proxy instance 是 token-proxy connect flow 的基础设施。

当 proxy instance disabled/deleted：

- proxy instance owner module 发出 lifecycle event。
- connection owner module 禁用 active proxy-backed connection。
- connection lifecycle 继续影响 subscription。
- subscription lifecycle 继续影响派生 task definition。

## Channel Binding Lifecycle

Channel binding 是投递通道映射。

当 channel binding suspended：

- notification fan-out 跳过该 binding。
- 不删除 channel。
- 不删除 subscription。
- 如果同一 channel 还有其他 active binding，其他线路继续投递。

当 channel binding deleted：

- 普通查询过滤。
- notification routing 不再使用。

## Subscription Lifecycle

Subscription 可 active、disabled、deleted。

当 subscription created：

- subscription owner module 创建派生 task definition。
- 如果对应派生 task definition 已存在，则更新 schedule、payload、metadata 并重新启用。

当 subscription activated：

- subscription owner module 恢复派生 task definition。

当 subscription disabled：

- subscription owner module 按 subscription metadata 禁用派生 task definition。
- subscription owner module 取消这些 task definition 的 pending task run。

当 subscription deleted：

- 普通查询过滤。
- subscription owner module 发出 `SubscriptionDeleted`。
- subscription owner module 删除或禁用关联派生 task definition。
- subscription owner module 取消这些 task definition 的 pending task run。
- notification event 作为历史记录保留。
- provider adapter 不处理 subscription 删除级联。

## Task Run Lifecycle

当 task run requested：

- task owner module 调用 task registry 执行 task run。
- task run 不存在时失败。
- task run 不是 pending 时直接返回。
- task definition 不存在时失败。
- task definition 已禁用时 task run 标记 failed。
- task handler 不存在时失败。
- 执行成功时 task run 标记 done，并更新 task definition run metadata。
- 执行失败时 task run 标记 failed，并更新 task definition failure metadata。

## Outbox/Inbox

生命周期事件应通过 outbox/inbox 处理：

- command 写主资源状态。
- command 写 outbox event。
- consumer 幂等消费。
- inbox 记录 handler 处理结果。

同步 API 不应该深度模拟所有异步副作用。
