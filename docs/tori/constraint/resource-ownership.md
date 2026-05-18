# Tori Resource Ownership

本文档定义 Tori domain 内资源归属、权限根和生命周期 owner。跨 domain ownership 约束见 [../../global/constraint.md](../../global/constraint.md)。

## Resource Matrix

| Resource                         | Owner domain        | Permission root                                                          | Lifecycle owner                   | Notes                                                    |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------- |
| `user_profile`                   | Tori                | `userId`                                                                 | auth/profile module               | 用户身份资料。                                           |
| `user_binding`                   | Tori                | `ownerUserId` / resolved user                                            | binding module                    | 外部平台 user 到 Tori user 的映射。                      |
| `channel`                        | Tori                | active channel binding access or admin                                   | binding module                    | 内部 channel 记录，不由 Bot runtime 拥有。               |
| `channel_binding`                | Tori                | `createdByUserId`, channel access, bot instance platform/namespace match | binding module                    | 外部平台 channel/chat 到 Tori channel 的映射。           |
| `connection`                     | Tori                | `ownerUserId`                                                            | integration connection module     | Provider account 记录；provider token 不在 Tori 内保存。 |
| `connection_credential`          | Tori reference only | `ownerUserId` via connection                                             | integration connection module     | 保存 credential reference，不保存 provider token 明文。  |
| `proxy_instance`                 | Tori registry       | admin or instance owner                                                  | integration proxy-instance module | Tori 对 token-proxy 节点的登记。                         |
| `token_proxy_connection_session` | Tori                | `ownerUserId`                                                            | integration connection module     | 短效 external connect session。                          |
| `bot_plugin_instance`            | Tori registry       | admin for management, runtime credential for ingress                     | bot-plugin module                 | 可信 bot runtime 实例。                                  |
| `delivery_endpoint`              | Tori registry       | admin for management, linked active bot instance for delivery            | bot-plugin module                 | Bot delivery target。                                    |
| `subscription`                   | Tori                | `ownerType` + `ownerId`                                                  | notification subscription module  | 基于 connection 取数并投递到 channel。                   |
| `notification_event`             | Tori                | subscription/channel access                                              | notification module               | 一次通知尝试和结果。                                     |
| `task.definition`                | Tori                | direct task owner or source resource owner                               | task module                       | 计划任务配置。                                           |
| `task.run`                       | Tori                | task definition access                                                   | task module                       | 单次执行记录。                                           |
| `outbox` / `inbox`               | Tori platform       | internal                                                                 | eventing modules                  | 内部异步事件处理记录。                                   |

## Rules

- 拥有资源的 module 发出 lifecycle event。
- 被影响资源的 owner module 消费 event 并决定处理方式。
- Dashboard API 只能展示当前用户或 admin 被授权访问的资源。
- Bot runtime 只能通过 bot-ingress 和 delivery protocol 影响 Tori 资源，不能直接拥有 Tori 业务资源。
- Token Proxy 只拥有 provider credential 和 provider data-plane，Tori 只保存 credential reference。
- 生命周期命令的 owner 边界以 [resource-lifecycle.md](resource-lifecycle.md) 为准。
- Lifecycle event 语义以 [lifecycle-events.md](lifecycle-events.md) 为准。

## Permission Rules

- `channel` 本身不是外部平台 channel。用户能访问 channel，必须来自 active channel binding、创建关系、订阅关系或 admin 权限。
- `channel_binding` 的管理权来自创建者、channel 可管理权或 admin。Bot runtime 只能通过 bot instance/platform/namespace match 证明请求上下文可信，不能因此获得 Dashboard 管理权。
- `proxy_instance` 对普通用户可见不等于可管理。公共 proxy instance 可以允许普通用户用于 connect flow，但管理命令仍属于 owner 或 admin。
- `bot_plugin_instance` 对普通用户可以只读展示；创建、禁用、删除、credential rotation 只能由 admin 执行。
- `delivery_endpoint` 不直接暴露给普通用户管理。普通用户只能通过 notification event 看到允许展示的 endpoint 摘要。
- 派生 `task.definition` 的权限跟随 source resource owner，例如 subscription-derived task 跟随 subscription access。
