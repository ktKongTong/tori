# Task Design

本文档描述 Tori task module 拥有的 task definition、task run、cron scanner 和 task registry。

## Resources

### `task.definition`

调度配置。

关系：

- 可以由 user 手动创建。
- 可以由 subscription lifecycle 派生。
- 派生 definition 通过 metadata 记录 `subscriptionId` 和 `subscriptionTaskDefinitionId`。

状态：

- enabled task definition 才会被 cron scanner 创建新 run。
- disabled task definition 不创建新 run。
- deleted task definition 普通查询不可见。

调度字段：

- `kind`：task handler id。
- `schedule`：调度表达式，由 task module 统一解析。
- `payload`：handler 输入，由 owning module 定义 schema。
- `metadata`：owner、来源和诊断信息。
- `lastTriggeredAt`：最近一次创建 run 的调度窗口。
- `lastRunStatus`：最近一次执行结果摘要。

### `task.run`

一次执行记录。

关系：

- 通过 `taskDefinitionId` 指向 task definition。

状态：

- pending。
- processing。
- done。
- failed。

错误字段：

- `summary`：用户和 Dashboard 可读的结果摘要。
- `errorCode`：机器可识别错误码。
- `errorMessage`：诊断信息。
- `retryable`：是否允许用户或系统重试。

### `outbox` / `inbox`

Task module 通过 Tori 内部 outbox/inbox 参与异步执行：

- owner command 在事务内写入资源状态和 outbox event。
- event router 分发 `TaskRunRequested`。
- consumer 使用 inbox 记录处理状态，保证 event handler 幂等。

## Operations

| Operation              | Resource          | Preconditions                                                 | Result / Side effect                               |
| ---------------------- | ----------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| create task definition | `task.definition` | caller owns task or source module requests derived definition | creates enabled or disabled definition             |
| update task definition | `task.definition` | visible and manageable task definition                        | updates schedule, payload, metadata, enabled state |
| delete task definition | `task.definition` | visible and manageable task definition                        | soft deletes definition and prevents new runs      |
| manual run             | `task.run`        | task definition visible and enabled                           | creates pending run and emits `TaskRunRequested`   |
| cron scan              | `task.run`        | due enabled task definition                                   | creates pending run and emits `TaskRunRequested`   |
| cancel pending runs    | `task.run`        | owner module requests cancellation by definition or metadata  | cancels pending runs before handler execution      |
| execute task run       | `task.run`        | run pending; definition enabled; handler exists               | marks processing, then done or failed              |

## Derived Task Definition

Subscription lifecycle 可以派生 task definition：

- 派生 definition 通过 metadata 标记来源。
- `metadata.source` 表示来源类型。
- `metadata.subscriptionId` 记录来源 subscription。
- `metadata.subscriptionTaskDefinitionId` 记录 subscription task definition。
- subscription created/activated 时应确保派生 definition 存在并可用。
- subscription disabled 时应禁用对应派生 definition，并取消 pending task run。

派生规则由 subscription module 定义；Task module 只负责保存 definition、调度 run 和执行 handler。

## Trigger

Task run 有两类触发入口：

- 手动触发：校验 task definition 可见性后创建 task run，并发出 `TaskRunRequested`。
- Cron scanner：扫描 due 的 enabled task definition，创建 task run，并发出 `TaskRunRequested`。

手动触发只创建 run request，不在同步请求中直接执行 handler。

Cron scanner 必须避免同一 definition 在同一调度窗口重复触发。调度窗口由 schedule 解析结果决定，而不是固定按自然分钟假设。

## Task Registry

Task handler 通过 task kind 注册到 task registry。

Task kind 命名应稳定，并能表达 owner module 和业务能力，例如 `steam.family.refresh`。Provider-specific handler 必须放在 provider adapter 或对应 owner module 下注册，不能把 provider 语义塞进通用 runner。

`TaskRunRequested` consumer 执行 task run 时必须满足：

- task run 存在。
- task run 仍处于 pending。
- task definition 存在且 enabled。
- task handler 存在。

执行过程：

- 执行前将 task run 标记为 processing。
- handler 成功后，将 task run 标记为 done，并更新 task definition 最近执行结果。
- handler 失败后，将 task run 标记为 failed，记录错误摘要，并更新 task definition 最近失败结果。

Retry 不是 task runner 的默认行为。是否允许重试由 task run 的 `retryable` 和 owning handler 的错误语义决定。

## Query Boundary

- task 查询必须先通过可见性检查。
- 手动 run、delete、update 不能绕过 `getVisibleTask`。
- task run history 通过 task definition access 间接授权。

## Lifecycle Effects

- subscription disabled 会禁用派生 task definition，并取消 pending task run。
- subscription deleted 会删除或禁用派生 task definition，并取消 pending task run。
- 已存在 pending run 执行时，如果 task definition 已禁用，会被标记 failed。
- provider-specific handler 需要自行校验执行所需的 connection、subscription、credential 状态。

Task runner 只统一校验 task definition 是否 enabled、handler 是否存在和 run 状态。Provider-specific handler 如果需要读取外部资源，仍必须在 handler 内校验 connection、subscription、credential 等依赖状态，不能假设异步 lifecycle consumer 一定已经完成。
