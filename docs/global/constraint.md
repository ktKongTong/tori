# Global Constraint

本文档记录跨 domain 的全局约束。只影响单个 domain 的约束，应放入该 domain 的 `constraint/`。

## Documentation

- 文档结构以 [../DOC-CONSTRAINT.md](../DOC-CONSTRAINT.md) 为准。

## Ownership

- 拥有资源的 domain 拥有该资源的生命周期语义。
- 其他 domain 只能通过协议、API 或 credential reference 观察和引用资源。
- Tori 业务资源不属于 Tori Proxy 或 Bot runtime。
- Tori Proxy credential 细节不能泄漏到通用 Tori Dashboard surface，除非通过明确的 connection/proxy DTO。
- Bot runtime 不承载 Tori 业务规则，不决定 Tori subscription、connection 或 task 的生命周期。

## Protocol

- 跨 Tori、Tori Proxy、Bot 的交互必须进入 [../protocol/](../protocol/README.md)。
- 其他 domain 可以引用 protocol，但不要复制协议正文。

## Implementation Boundary

- Provider-specific 行为属于 provider adapter，不属于 platform core。
- Platform module 可以提供 shared capability，但不能偷取业务资源 ownership。
- Dashboard navigation 只负责体验展示，权限必须由后端校验。

## Verification

使用 Vite+ 命令验证：

- `vp check`
- `vp test`

不要用 package-manager-specific 命令替代项目级验证。
