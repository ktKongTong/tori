# User Operations

## Identity

用户可以：

- 查看自己的 user binding。
- 删除自己的 user binding。
- 查看自己创建或拥有的 channel binding。
- 删除自己可管理的 channel binding。

## Connection

用户可以：

- 查看自己的 connection。
- 创建 public-id connection。
- 选择 token-proxy instance 进行 external connect。
- 禁用自己的 connection。
- 删除自己的 connection。

Connection detail 展示 provider account、proxy 摘要、创建时间、更新时间、连接时间和同步时间。

## Token Proxy Instance

用户可以：

- 查看公共 token-proxy instance。
- 查看自己的 token-proxy instance。
- 创建、修改、删除自己的 token-proxy instance。

用户不能修改公共 token-proxy instance。

## Bot Instance

用户可以查看 bot instance。用户不能创建、修改、删除 bot instance。

## Subscription

用户可以：

- 查看自己的 subscription。
- 创建 subscription。
- 启用 subscription。
- 停用 subscription。
- 删除 subscription。

Subscription target 由 connection type 和 event type 决定。

## Task

用户可以：

- 查看自己可访问的 task。
- 查看 task run history。
- 手动运行允许的 task。

停用 subscription 后，关联派生 task definition 不继续执行。
