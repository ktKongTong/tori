# Bot Plan

本计划只记录 Bot domain 当前仍需处理的运行时和命令文档缺口。已经完成的迁移和补写记录不放在 active plan 中。

## Active

### Runtime Code Alignment

Scope:

- 对照当前 bot runtime 代码补齐运行时入口。
- 记录 update receiving、command parsing、Tori bot-ingress client、delivery client。
- 记录 trusted credential 的读取、使用和失败行为。

Validation:

- Bot domain 不拥有 Tori business resource lifecycle。
- Platform-specific rendering 留在 Bot domain。
- Bot design 能独立说明当前 runtime 如何调用 protocol。

### Command Workflow Requirements

Scope:

- claim/bind command workflow。
- connect command workflow。
- subscribe/unsubscribe command workflow。
- status command workflow。
- unsupported command 和权限不足反馈。
- notification delivery failure rendering。

Validation:

- 用户可见消息不暴露 Tori 内部 id。
- 失败状态有恢复指引。
- Bot requirement 只写用户可见行为，协议 shape 链接 protocol 文档。
