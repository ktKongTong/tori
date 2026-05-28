# Tori Proxy 架构设计

## 运行时角色

Tori Proxy 是 provider auth、credential storage、token refresh 和通用 provider proxy 的执行边界。

Tori Proxy 不承载 provider 业务语义。它可以知道某个 provider 的 auth/refresh 方式，例如 Steam 登录和 token refresh，但不能提供 `steam-family`、`steam-inventory` 这类业务 endpoint。

## 服务组合

主要 route group：

- health
- oauth
- admin
- proxy
- account

`proxy` 是通用 data-plane endpoint。调用方提供目标 URL，Tori Proxy 按 connection、API key permission 和 proxy rule 校验后注入 credential 并转发请求。

## 模块形态

```txt
route
  -> provider registry
  -> repository
  -> generic proxy / provider auth API
```

## 存储所有权

Tori Proxy 拥有：

- proxy-side connection
- credential
- auth session
- auth code
- API key
- generic permission
- proxy rule
- request log
- system task
- refresh log

## 外部连接

- Tori：external connect session、callback exchange、credential reference。
- Provider：OAuth、refresh、provider auth API。
- Browser popup：existing token selection 和 new token auth。

Provider-specific business orchestration 属于 Tori。比如 Steam family/library 的请求编排、结果归一化、缓存和通知构造都由 Tori 的 Steam module 负责；Tori Proxy 只执行受规则约束的通用转发。
