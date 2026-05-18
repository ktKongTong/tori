# Runtime Registry Design

本文档描述 Tori bot-plugin module 拥有的 bot plugin instance 和 delivery endpoint。

资源生命周期命令边界见 [../constraint/resource-lifecycle.md](../constraint/resource-lifecycle.md)。

## Resources

### `bot_plugin_instance`

可信 bot runtime 的登记。

关系：

- bot instance 可关联一个 delivery endpoint。
- channel binding 通过 `botPluginInstanceId` 指向 bot instance。
- notification event 可记录 bot instance。

状态：

- active bot instance 可通过 runtime credential 调用 bot-ingress，并可作为 notification delivery candidate。
- disabled/deleted bot instance 不能继续认证，也不能参与 notification candidate generation。

Runtime credential 只用于 Bot runtime 调用 Tori bot-ingress。它不用于 Tori 向 Bot runtime delivery endpoint 发起投递。

### `delivery_endpoint`

平台向 bot 投递通知的目标。

关系：

- bot instance 可引用一个 active delivery endpoint。
- notification event 可记录实际 delivery endpoint。

Delivery endpoint 保存 Tori 调用 Bot runtime 所需的 endpoint URL、认证方式和 secret reference。Endpoint secret 用于 Bot Delivery 请求签名，不等同于 bot runtime credential。

状态：

- active endpoint 可用于 notification delivery。
- disabled endpoint 不参与候选选择。
- deleted endpoint 普通查询不可见。

## Operations

| Operation                       | Resource              | Preconditions              | Result / Side effect                                                           |
| ------------------------------- | --------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| register bot instance           | `bot_plugin_instance` | admin                      | creates trusted bot instance and returns runtime credential once               |
| update bot instance             | `bot_plugin_instance` | admin                      | updates name, capabilities, status; disabled emits lifecycle event             |
| rotate runtime credential       | `bot_plugin_instance` | admin                      | replaces bot-ingress credential                                                |
| revoke runtime credential       | runtime credential    | admin                      | invalidates current bot-ingress credential; bot instance resource is unchanged |
| delete bot instance             | `bot_plugin_instance` | admin                      | soft deletes bot instance and emits deleted lifecycle event                    |
| attach delivery endpoint        | `delivery_endpoint`   | admin; bot instance exists | creates or updates endpoint reference                                          |
| update delivery endpoint status | `delivery_endpoint`   | admin                      | enables/disables endpoint candidate selection                                  |
| rotate endpoint secret          | `delivery_endpoint`   | admin                      | replaces Bot Delivery signing secret with optional previous-secret window      |

## Query Boundary

- bot instance 管理入口 admin-only。
- runtime credential 只用于可信 bot runtime 认证。
- 普通用户可以看到允许展示的 bot instance 摘要，但不能管理 bot instance。

## Delivery Candidate Selection

Notification routing 选择 bot delivery candidate 时必须同时满足：

- channel binding active。
- bot instance active。
- delivery endpoint active。
- bot instance platform/namespace 与 channel binding 匹配。

如果 bot instance disabled/deleted，runtime credential auth 和 notification candidate generation 都必须拒绝它。

如果 runtime credential 被 revoke，只有该 credential 失效；是否禁用 bot instance 是独立的 bot instance operation。

## Credential Boundary

Runtime credential 和 delivery endpoint secret 是两个方向的 credential：

- Runtime credential：Bot runtime -> Tori，用于 bot-ingress。
- Delivery endpoint secret：Tori -> Bot runtime，用于 bot-delivery 签名。

两者必须独立轮换、独立吊销、独立审计。

## Lifecycle Effects

- bot instance disabled/deleted 会异步 suspend 相关 channel binding。
- subscription 和 channel 不因为 bot instance 失效而删除。
- runtime credential auth 必须拒绝 disabled/deleted bot instance。
- notification candidate generation 必须拒绝 disabled/deleted bot instance。
