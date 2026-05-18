# Tori Plan

本计划只记录 Tori domain 当前仍需处理的文档和产品规格缺口。已经完成的迁移和补写记录不放在 active plan 中。

## Active

### Repository Permission Audit

Scope:

- 对照 `docs/tori/constraint/resource-ownership.md` 检查 repository/query 权限。
- 覆盖 [binding](../../design/binding.md)、[connection](../../design/connection.md)、[runtime registry](../../design/runtime-registry.md)、[subscription](../../design/subscription.md)、[task](../../design/task.md)。
- 标记 admin-only、owner-only、runtime credential-only 的 query/command。

Validation:

- 文档中的 permission root 能在代码入口找到对应校验。
- Dashboard API 不依赖前端过滤来补权限。

### Dashboard Workflow Requirements

Scope:

- 首次设置 workflow。
- Connection create/detail/remove workflow。
- Subscription target creation workflow。
- Task detail/run history workflow。
- Admin bot/proxy/runtime health workflow。

Validation:

- 每个 workflow 写清前置条件、成功状态、失败状态和恢复入口。
- 普通用户和 admin 的入口分开描述。
- Provider-specific command 只出现在 matching provider detail。

### Module Design Completion

Scope:

- 补齐 connection、binding、runtime registry、subscription、task 的目标设计细节。
- 明确每个 module 的资源、命令、查询边界、事件输入输出和 Dashboard DTO 关系。
- 将实现入口、历史审计和已完成迁移内容排除出 design 正文。

Validation:

- 每个 module design 能独立说明资源如何创建、更新、查询、失效和影响下游。
- 文档不要求所有资源实现统一命令枚举或统一预检 endpoint。
- UI 命令来自具体资源 API，而不是通用资源操作协议。

### Provider Task Handler Alignment

Scope:

- 找出当前 provider-specific task handler。
- 记录 handler 执行前需要校验的 connection、subscription、credential 状态。
- 对齐 `docs/tori/design/task.md` 的 runtime dependency handling。

Validation:

- 文档不暗示通用 runner 已经覆盖 provider dependency check。
- 失败原因能落到 task run error summary。
