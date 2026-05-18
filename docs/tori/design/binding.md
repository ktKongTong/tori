# Binding Design

本文档描述 Tori binding module 拥有的 user binding、channel、channel binding 和 binding grant。

资源生命周期命令边界见 [../constraint/resource-lifecycle.md](../constraint/resource-lifecycle.md)。

## Resources

### `user_binding`

外部平台 user 到 Tori user 的映射。

关系：

- 通过 platform、external user identity 关联外部平台用户。
- 通过 Tori user id 关联内部用户。

### `channel`

Tori 内部投递目标记录。

关系：

- channel binding 通过 `channelId` 连接外部平台 channel/chat。
- subscription 通过 `channelId` 指向投递目标。

### `channel_binding`

Tori internal channel 到外部平台 channel/chat 的映射。

关系：

- `channelId` 指向内部 channel。
- `botPluginInstanceId` 指向可信 bot instance。
- subscription 不直接绑定 bot instance，只绑定 channel。

状态：

- active channel binding 可用于 notification routing。
- suspended channel binding 保留记录，但 notification fan-out 跳过。
- deleted channel binding 普通查询不可见。

### Binding Grant

短效 claim/bind token/code，用于跨 web 和 bot 完成身份或 channel 绑定。

类型：

- `claim-user`：外部平台用户声明自己对应哪个 Tori user。
- `bind-user`：已登录 Tori user 主动绑定外部平台身份。
- `bind-channel`：将外部平台 channel/chat 绑定到 Tori channel。

Binding grant 必须短效、单次消费，并绑定 platform、namespace、外部 user 或 channel 上下文。

### Anonymous Claim Session

未绑定外部平台用户触发需要 Tori 身份的 command 时，binding module 可以创建匿名 claim session。

匿名 claim session 只表达“某个外部平台身份正在等待绑定”，不能获得 Tori user 权限。用户在 Web 侧完成认证并消费 claim 后，binding module 才能创建 user binding。

## Operations

| Operation               | Resource                     | Preconditions                                                             | Result / Side effect                                   |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| issue binding grant     | binding grant                | caller has enough context for claim/bind intent                           | creates short-lived single-use token/code              |
| consume anonymous claim | `user_binding`               | user authenticated; claim valid and unexpired                             | creates user binding for external user                 |
| bind user               | `user_binding`               | user authenticated; external identity proof valid                         | creates or updates user binding                        |
| bind channel            | `channel`, `channel_binding` | caller can manage target channel; bot instance matches platform/namespace | creates channel if needed and active channel binding   |
| suspend channel binding | `channel_binding`            | bot instance lifecycle or owner/admin command                             | marks binding suspended; notification routing skips it |
| delete user binding     | `user_binding`               | owner or admin                                                            | soft deletes external user mapping                     |
| delete channel binding  | `channel_binding`            | creator/channel manager/admin                                             | soft deletes external channel mapping                  |

## Query Boundary

- user binding 查询只返回当前用户自己的绑定。
- channel binding 查询返回当前用户创建或可管理的 channel binding。
- admin 可以查看全部 binding。

## Resolution Boundary

Bot ingress 和 notification routing 通过 binding module 解析外部平台上下文：

- external user -> user binding -> Tori user。
- external channel/chat -> channel binding -> Tori channel。
- channel binding -> bot instance，用于确认该 runtime 是否有权代表该 external channel。

如果 user binding 不存在，Bot ingress 可以进入 claim/bind workflow，但不能静默创建具备权限的 Tori user 状态。

如果 channel binding 不存在，subscription 创建和 notification routing 必须失败或跳过，并返回可恢复原因。

## Channel Binding Selection

同一 Tori channel 可以有多条 channel binding，用于不同平台、namespace 或 bot instance。

Notification routing 选择 channel binding 时必须满足：

- binding status 为 active。
- bot instance 可用。
- platform 和 namespace 与目标一致。
- delivery endpoint 可用。

某条 binding suspended/deleted 不影响同一 channel 下其他 active binding。

## Lifecycle Effects

- bot instance disabled/deleted 只影响 channel binding，不删除 channel 和 subscription。
- 同一 channel 可存在多条 binding；某条 binding suspended 不应影响其他 active binding。
- notification routing 必须跳过 suspended/deleted channel binding。
