# Commands And Delivery Product Spec

## Commands

用户在外部平台发送命令。Bot runtime 将命令转发给 Tori。

常见命令类型：

- status
- claim
- bind
- connect
- subscribe
- unsubscribe

## Claim And Bind

未绑定用户发送需要身份的命令时，Bot 返回 claim/bind 引导。用户完成绑定后，相同外部平台身份映射到 Tori user。

## Delivery

通知由 Tori 产生业务事件数据和投递目标。Bot runtime 根据事件类型、数据 schema 和平台能力渲染为平台消息。

用户看到的是平台原生消息，不暴露 Tori 内部 id、task kind、topic key。

## Failure

投递失败时，Bot runtime 返回失败结果。Tori Dashboard 展示失败原因和可恢复操作。
