# Credential And Permission 设计

## Credential 边界

Tori Proxy 保存 provider credential。Tori 保存 credential reference。

Credential 包含 provider token、refresh state、expiration、metadata 和 status。

## API Key

Tori 调用 Tori Proxy generic proxy 使用 API key。API key 绑定 permission。

常见 permission：

- `proxy`
- `account`

## Generic Proxy

通用 proxy route 在执行前校验：

- API key 有效。
- Permission 覆盖请求能力。
- Connection 存在且 active。
- Credential 可用或可刷新。
- 目标 URL 命中 provider proxy rule。

Tori Proxy 不定义 provider 业务 endpoint。Provider-specific 业务能力由 Tori 模块决定目标 URL、请求参数、响应解析和领域模型写入。

## Refresh

System task 刷新 provider credential。刷新结果写入 refresh log。

Refresh 失败后，credential status 和 request log 必须能支持排障。
