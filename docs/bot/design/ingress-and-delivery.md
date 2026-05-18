# Ingress And Delivery Design

## Ingress

Bot runtime 接收外部平台 update，并构造 Tori bot-ingress request。

Request context 包含：

- platform
- namespace
- bot instance identity
- external user id
- external user display name
- external channel id
- external channel name
- message text
- command args

Tori 负责解析 user binding、channel binding、claim flow 和 command registry。

## Delivery

Tori 通过 delivery endpoint 调用 Bot runtime。Bot runtime 接收业务事件数据和投递目标，并将其渲染为平台消息。

Delivery response 返回：

- success/failure
- external message id
- retryable flag
- error code
- error message

## Trusted Credential

Bot runtime 使用可信 credential 调用 Tori。Bot instance 由 Tori admin 管理。

普通用户只能查看 bot instance，不能创建、修改或删除。

## Renderer

Renderer 属于 Bot domain。Tori 不保存平台最终文案，也不向 Bot runtime 发送消息排版结构。Tori 保存业务事件数据、投递目标和标准化投递结果。
