# Connection Design

本文档描述 Tori integration connection module 拥有的 connection、connection credential、proxy instance registry 和 token-proxy connection session。

资源生命周期命令边界见 [../constraint/resource-lifecycle.md](../constraint/resource-lifecycle.md)。

## Resources

### `connection`

Tori 对 provider account 的记录。它包含 provider、provider account identity、access mode、status、proxy instance reference 和同步时间。

关系：

- `ownerUserId` 指向拥有者。
- `proxyInstanceId` 可选，表示该 connection 通过 token-proxy 取得能力。
- subscription 通过 `connectionId` 使用该数据源。

状态：

- `active`：可被 subscription 使用。
- `disabled`：不再参与 provider access。
- `deleted`：普通查询不可见。

#### Access Mode

`connection.accessMode` 描述 Tori 如何取得 provider 能力：

- `public-id`：Tori 只保存 provider account identity，不具备 provider credential。它只能用于无需 credential 的公开资料、展示或弱关联能力。
- `proxy-token`：Tori 通过 Tori Proxy 的 credential reference 调用 provider data-plane。
- `mixed`：同一个 connection 同时保留 public identity 和 proxy-backed capability。公开资料可以不走 proxy；需要 provider credential 的能力必须走 proxy。

Provider access resolver 必须根据 capability 决定是否需要 credential reference。不能因为 connection 存在就假设它可执行 provider data-plane 请求。

#### Public-id To Proxy-backed

当同一 owner 已存在 public-id connection，用户通过 token-proxy external connect 完成同一 provider account 授权时，connection module 可以将其升级为 proxy-backed connection。

升级规则：

- provider account identity 必须来自 Tori Proxy exchange response，不能来自 browser。
- 原 connection 的 owner 不变。
- 写入或更新 `connection_credential`。
- access mode 按 owner module 决策变为 `proxy-token` 或 `mixed`。
- subscription 不需要重新绑定 connection id。

### `connection_credential`

Tori 保存 credential reference，不保存 provider token 明文。

关系：

- `connection_credential.connectionId` 指向 connection。
- `proxyInstanceId` 指向 token-proxy instance。
- `credentialRef` 指向 token-proxy 内的 provider credential/API key。

### `proxy_instance`

Tori 对 token-proxy 节点的登记。保存 base URL、credential reference、health status、capabilities 和 owner。

关系：

- `ownerUserId` 指向登记者。
- connection 通过 `proxyInstanceId` 引用 proxy instance。
- token-proxy connection session 通过 `proxyInstanceId` 绑定一次 connect flow。

状态：

- `active`：可启动 token-proxy connect flow。
- `disabled`：拒绝新的 connect flow，并异步影响 proxy-backed connection。
- `deleted`：普通查询不可见。

### `token_proxy_connection_session`

短效 external connect session。

关系：

- `ownerUserId` 指向发起连接的用户。
- `proxyInstanceId` 指向使用的 token-proxy。
- callback 完成后可记录 `connectionId`。

状态：

- `pending`：等待 Tori Proxy callback。
- `completed`：已完成 exchange 并写入 connection。
- `failed`：provider auth、callback 校验或 exchange 失败。
- `expired`：超过有效期，不能再完成。

Session 只绑定一次 external connect flow。重复 callback 只能返回已有完成或失败结果，不能创建第二条 connection。

## Operations

| Operation                     | Resource                                                                | Preconditions                                                                  | Result / Side effect                                                            |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| create public-id connection   | `connection`                                                            | user authenticated; provider account identity is acceptable without credential | creates active public-id connection; no credential reference                    |
| start token-proxy connection  | `token_proxy_connection_session`                                        | user authenticated; proxy instance usable; provider supported                  | creates pending session and external connect URL                                |
| complete token-proxy callback | `connection`, `connection_credential`, `token_proxy_connection_session` | session pending; state valid; exchange code valid                              | creates or updates proxy-backed connection and credential reference             |
| update connection status      | `connection`                                                            | caller owns connection or admin                                                | updates status; disabled emits lifecycle event and disables active credential   |
| delete connection             | `connection`                                                            | caller owns connection or admin                                                | soft deletes connection, clears credential/session/cache, emits lifecycle event |
| register proxy instance       | `proxy_instance`                                                        | caller allowed to register proxy                                               | creates or updates owner/baseUrl registry entry                                 |
| probe proxy instance          | `proxy_instance`                                                        | caller owns proxy or admin                                                     | refreshes health and capabilities                                               |
| update proxy status           | `proxy_instance`                                                        | owner or admin                                                                 | updates status; disabled emits lifecycle event                                  |
| delete proxy instance         | `proxy_instance`                                                        | owner or admin                                                                 | soft deletes proxy instance and clears pending sessions                         |

Connection module 不提供跨资源通用操作。影响 subscription、task 的下游处理通过 lifecycle event 触发。

## Query Boundary

- 普通用户只能查询自己的 connection。
- 普通用户只能查询自己登记的 proxy instance，或系统明确允许普通用户使用的 public proxy instance。
- Admin 可以 include all。
- Dashboard DTO 可以展示 proxy 摘要，但不能暴露 provider credential 明文。

## Provider Access Resolver

Provider access resolver 是 connection module 对 provider adapter 暴露的能力解析边界。

输入：

- connection id。
- required provider capability。
- 当前调用者上下文。

输出：

- public account identity，如果 capability 不需要 credential。
- proxy instance reference 和 credential reference，如果 capability 需要 provider credential。
- 拒绝原因，例如 connection disabled、connection deleted、credential missing、proxy unavailable、capability unsupported。

Provider adapter 不能绕过 resolver 直接读取 credential reference。

## Lifecycle Effects

- connection disabled/deleted 会禁用依赖 subscription，进而禁用派生 task definition。
- proxy instance disabled/deleted 会禁用 active proxy-backed connection，再传播到 subscription 和 task definition。
- Provider access resolver 必须拒绝 disabled/deleted connection。

Lifecycle event 语义见 [../constraint/lifecycle-events.md](../constraint/lifecycle-events.md)。

## Constraints

- proxy-backed connection 必须指定 active proxy instance。
- 同一 owner、provider、provider account、access mode 只能对应一条 connection。
- Tori 只保存 credential reference；provider credential 明文属于 Tori Proxy。
- Browser 传入的 provider account identity 只能用于展示草稿，不能作为 connection 写入依据。
