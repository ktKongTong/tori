# Global Overview

Tori 是由 Tori、Tori Proxy、Bot 和 Protocol 四个 domain 组成的系统。

## Domains

### Tori

Tori 是主产品和控制平面，负责用户、连接、订阅、通知、任务、Dashboard API 和资源生命周期。

### Tori Proxy

Tori Proxy 是 provider credential 和 provider data-plane 的执行边界，负责 provider auth、token storage、token refresh、proxy-side account selection 和 external connect。

### Bot

Bot 是外部平台 runtime，负责接收平台消息、以可信 bot instance 身份调用 Tori、渲染平台消息，并通过平台 API 投递通知。

### Protocol

Protocol 记录跨 domain 通信，包括 Tori Proxy connect、Bot ingress 和 Bot delivery。

Tori 内部 owner module lifecycle event 属于 Tori domain，不属于 Protocol。

## Truth Order

当文档互相冲突时：

1. 当前代码和数据库 schema 对已实现行为拥有最高优先级。
2. `docs/protocol/` 对跨 domain 交互拥有最高优先级。
3. 各 domain 的 `constraint/` 对 domain 内约束拥有最高优先级。
4. 各 domain 的 `design/` 说明当前设计和已接受方案。
5. `exec-plan/completed/` 只作为执行历史，不覆盖当前约束和设计。
