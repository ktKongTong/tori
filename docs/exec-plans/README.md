# Exec Plans

`exec-plans/` 只保存跨多个顶层 domain 的全局执行计划。

## 目录

- [active/](active/)：正在执行或准备执行的跨 domain 计划。
- [completed/](completed/)：已经完成、暂停或仅作为历史参考的跨 domain 计划。

## 单 Domain 计划

单个 domain 内的小计划写入：

- `docs/tori/exec-plan/`
- `docs/tori-proxy/exec-plan/`
- `docs/bot/exec-plan/`
- `docs/protocol/exec-plan/`

## 命名

全局计划文件名使用顶层 domain 或协议名：

- `tori-*.md`
- `tori-proxy-*.md`
- `bot-*.md`
- `protocol-*.md`

## 模板

```md
# <计划名称>

## Status

active | completed

## Domains

## Scope

## Non-Goals

## Touched Protocols

## Data Model Impact

## API Impact

## Frontend Impact

## Security Impact

## Quality Score Target

## Steps

## Validation Checklist

## Known Gaps
```
