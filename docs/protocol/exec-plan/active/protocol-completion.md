# Protocol Plan

本计划只记录 protocol domain 当前仍需处理的协议缺口。已经完成的迁移和补写记录不放在 active plan 中。

## Active

### Protocol Target Alignment

Scope:

- 确保 `docs/protocol/design/` 只记录 Tori、Tori Proxy、Bot、Browser 之间的目标协议。
- 清理 protocol 文档中 Tori 内部模块事件、资源命令和实现状态描述。
- 将 Tori 内部事件、资源命令和当前实现差距归回 Tori domain。

Validation:

- Protocol design 不包含当前代码入口。
- Protocol design 不定义资源生命周期命令。
