# Tori Proxy

Tori Proxy 是 token-proxy 组件，负责 provider credential、provider auth 和通用 provider proxy。

## Owned Scope

- Provider credential storage
- Provider auth sessions
- Existing token selection
- Provider token refresh
- API keys and permissions
- Generic provider proxy
- Request logs
- Refresh logs
- System tasks inside token-proxy

Tori Proxy 只允许 provider auth/refresh 代码具备 provider-specific 知识。Provider 业务 API 的编排和响应解释属于 Tori。

## Local Docs

- [requirement/](requirement/README.md)
- [design/](design/README.md)
- [constraint/](constraint/README.md)
- [exec-plan/active/](exec-plan/active/README.md)
- [exec-plan/completed/](exec-plan/completed/README.md)

## Related Protocols

- [../protocol/design/tori-token-proxy-connect.md](../protocol/design/tori-token-proxy-connect.md)
