# Credential And Permission 设计

## Credential 边界

Tori Proxy 保存 provider credential。Tori 保存 credential reference。

Credential 包含 provider token、refresh state、expiration、metadata 和 status。

## API Key

Tori 调用 Tori Proxy data-plane 使用 API key。API key 绑定 permission。

常见 permission：

- `proxy`
- `account`
- `steam-family`

## Data Plane

Data-plane route 在执行前校验：

- API key 有效。
- Permission 覆盖请求能力。
- Connection 存在且 active。
- Credential 可用或可刷新。

## Refresh

System task 刷新 provider credential。刷新结果写入 refresh log。

Refresh 失败后，credential status 和 request log 必须能支持排障。
