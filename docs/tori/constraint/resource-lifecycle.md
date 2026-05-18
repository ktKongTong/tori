# Resource Lifecycle Constraint

本文档定义 Tori domain 内资源生命周期命令的 ownership 边界。

## Core Rule

Tori 不维护全局的资源操作协议。

`disable`、`enable`、`delete` 这类词是模块命令或业务行为，不是跨资源通用状态，也不是所有资源都适用的统一操作集合。

`revoke` 只用于 credential、token、secret、grant 这类可撤销授权材料，不用于普通资源生命周期。

每个资源是否支持某个生命周期命令、命令叫什么、命令产生什么影响，只能由该资源 owner module 定义。

## Module Ownership

| Resource              | Owner module               | Lifecycle command owner |
| --------------------- | -------------------------- | ----------------------- |
| `user_binding`        | binding                    | binding module          |
| `channel_binding`     | binding                    | binding module          |
| `connection`          | integration connection     | connection module       |
| `proxy_instance`      | integration proxy-instance | proxy-instance module   |
| `bot_plugin_instance` | bot-plugin                 | bot-plugin module       |
| `subscription`        | notification subscription  | subscription module     |
| `notification_event`  | notification               | notification module     |
| `task.definition`     | task                       | task module             |
| `task.run`            | task                       | task module             |

其他模块只能通过 owner module 暴露的 command、query 或 lifecycle event 影响资源，不能自行解释该资源的删除、禁用、撤销或恢复语义。

## No Global Command API

禁止把资源生命周期命令抽象成跨模块的全局 command API。

不应定义类似以下全局协议：

- 所有资源都支持同一套命令枚举。
- 所有资源都必须实现统一的命令 endpoint。
- 所有资源都必须实现统一的预检 endpoint。
- UI 通过通用命令名称推断业务影响。

如果某个模块需要在执行命令前给 Dashboard 展示影响说明，该说明属于该模块自己的 API/DTO 设计，不属于 protocol domain，也不要求其他资源跟随。

## State Is Not Action

状态字段描述资源当前事实；命令描述一次行为。

约束：

- `disabled`、`suspended`、`deleted` 如果存在，只能按具体资源定义解释。
- 不能因为两个资源都有相似状态名，就假设它们支持相同命令。
- 不能因为一个资源有 delete command，就要求其他资源也提供 delete command。
- `revoke` 这类凭证相关行为不能泛化到普通业务资源。

## UI Rule

Dashboard 可以展示资源命令，但命令来源必须是具体资源模块：

- Connection 页面展示 connection module 定义的命令。
- Bot instance 页面展示 bot-plugin module 定义的命令。
- Subscription 页面展示 subscription module 定义的命令。
- Task 页面展示 task module 定义的命令。

UI 文案必须描述具体资源影响，不能使用全局模板推断影响。

## Relation To Lifecycle Events

生命周期事件只描述已经发生的资源事实，见 [lifecycle-events.md](lifecycle-events.md)。

事件 consumer 可以处理下游影响，但不能反向定义上游资源支持哪些命令。
