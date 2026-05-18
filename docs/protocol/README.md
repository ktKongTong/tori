# Protocol

Protocol 是跨 Tori、Tori Proxy、Bot 的交互 domain。

协议文档描述独立组件之间如何交互，不应埋在某个组件自己的 design 文件里。

## Owned Scope

- Tori 到 Tori Proxy 的 external connect 协议。
- Bot 到 Tori 的 ingress 协议。
- Tori 到 Bot 的 delivery 协议。

## Protocol Ownership

| 协议                     | 组件                            | 状态        | 文档                                                                     |
| ------------------------ | ------------------------------- | ----------- | ------------------------------------------------------------------------ |
| Tori Token Proxy Connect | Tori、Tori Proxy、browser popup | active spec | [design/tori-token-proxy-connect.md](design/tori-token-proxy-connect.md) |
| Tori Bot Ingress         | Bot、Tori                       | active spec | [design/tori-bot-ingress.md](design/tori-bot-ingress.md)                 |
| Bot Delivery             | Tori、Bot                       | active spec | [design/bot-delivery.md](design/bot-delivery.md)                         |

## Protocol Doc Requirements

每份协议文档应定义：

- participants
- trust boundary
- request and response shapes
- state machine
- retry and idempotency rules
- error semantics
- security requirements
- browser behavior, if any
- validation scenarios

## Local Docs

- [requirement/](requirement/README.md)
- [design/](design/README.md)
- [constraint/](constraint/README.md)
- [exec-plan/active/](exec-plan/active/README.md)
- [exec-plan/completed/](exec-plan/completed/README.md)
