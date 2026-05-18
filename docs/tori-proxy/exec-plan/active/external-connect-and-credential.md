# Tori Proxy Plan

本计划只记录 Tori Proxy domain 当前仍需处理的 external connect、credential 和 data-plane 文档缺口。已经完成的迁移和补写记录不放在 active plan 中。

## Active

### External Connect Code Alignment

Scope:

- 对照当前 token-proxy route 补齐 browser-facing external connect flow。
- 记录 existing token selection、新建 token auth、account confirmation、callback status。
- 记录 one-time exchange code 的生成、消费、过期和失败语义。

Validation:

- External connect spec 与 `protocol/design/tori-token-proxy-connect.md` 一致。
- Product spec 覆盖 success、cancel、expired、provider failure、exchange failure。
- Tori Proxy design 不复制 protocol 正文，只记录本 domain 实现。

### Credential And Permission Code Alignment

Scope:

- API key permission model。
- Provider credential status model。
- Refresh log 和 request log。
- Data-plane route authorization。
- Provider token refresh failure handling。

Validation:

- Tori 只保存 credential reference。
- Tori Proxy 保存 provider credential。
- data-plane 权限不能绕过 API key permission。
