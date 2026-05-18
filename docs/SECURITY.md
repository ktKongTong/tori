# SECURITY

本文档定义 Tori 的信任边界、认证、授权、凭证存储和跨组件安全规则。

## Trust Boundaries

| 边界                            | 可信侧       | 非可信侧或低信任侧         | 主要风险                                             |
| ------------------------------- | ------------ | -------------------------- | ---------------------------------------------------- |
| Browser -> Tori API             | Tori API     | Browser session            | CSRF、越权、表单篡改。                               |
| Tori -> Token Proxy             | Tori service | Network boundary           | callback 重放、API key 泄漏、provider account 混淆。 |
| Browser Popup -> Token Proxy    | Token Proxy  | Browser popup              | state/code 重放、错误 callback。                     |
| Bot Runtime -> Tori Bot Ingress | Tori API     | Bot runtime request        | bot credential 泄漏、external user spoofing。        |
| Tori -> Bot Delivery            | Bot runtime  | Tori notification producer | delivery endpoint secret 泄漏、重复投递。            |
| Token Proxy -> Provider         | Provider     | Token Proxy data-plane     | token 过期、refresh 失败、provider permission 不足。 |

## Authentication

### Tori Dashboard

Tori Dashboard 使用 Better Auth session。API middleware 解析 session，构建 user context 和 role。

### Tori Admin

Admin 操作需要 session user 具备 admin role。前端隐藏入口只改善体验，后端 API 必须校验 admin 权限。

### Token Proxy

Token Proxy 的管理入口使用 admin key 或 session 机制。Data-plane API 使用 API key 和 permission 控制。

### Bot Runtime

Bot runtime 调用 Tori bot-ingress 时必须携带可信 bot instance credential。Tori 根据 bot instance、platform、namespace 解析上下文。

## Authorization

普通用户访问控制以资源字段为根：

- `ownerUserId`
- `createdByUserId`
- `ownerType`
- `ownerId`

Admin 可查看系统资源和公共基础设施。Bot instance 管理属于 admin-only 操作。

Token-proxy instance 可见性规则：

- 公共 instance 对普通用户可见。
- 用户自有 instance 对 owner 可管理。
- 公共 instance 只有 admin 可管理。

## Credential Rules

Tori 保存 credential reference，不保存 provider token 明文。

Token Proxy 保存 provider credential，并负责 refresh、exchange、provider data-plane。

Bot credential 只用于可信 bot runtime 与 Tori/Bot delivery 认证。

## Callback And Replay

External connect callback 必须绑定：

- `sessionId`
- `state`
- one-time `code`
- `ownerUserId`
- `proxyInstanceId`
- `provider`

完成 callback 时必须保证 session/code 只消费一次。重复 callback 返回已完成或失败结果，不应创建重复 connection。

## Resource Lifecycle And Visibility

资源生命周期命令的 owner 边界以 [tori/constraint/resource-lifecycle.md](tori/constraint/resource-lifecycle.md) 为准。具体资源是否支持删除、禁用、挂起、撤销或恢复，由对应 owner module 定义。
