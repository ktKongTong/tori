# Documentation Constraint

本文档定义 `docs/` 的长期组织约束。新增、迁移或重写文档时，应先遵守这里的结构，再决定具体文件名和内容。

## Top-Level Structure

`docs/` 顶层按 domain 组织，保持以下核心 domain：

```txt
docs/
├── tori/
├── tori-proxy/
├── bot/
├── protocol/
├── global/
└── exec-plans/
```

顶层不按文档类型拆分。不要在 `docs/` 根目录新增 `arch/`、`design/`、`requirement/`、`constraint/`、`product-spec/` 这类跨 domain 类型目录。

`docs/exec-plans/` 是唯一允许的顶层非 domain 例外，用于保存跨多个顶层 domain 的全局执行计划。它等价于 global exec-plan 的专用目录，不承载当前架构、需求、设计或约束正文。

## Domain Ownership

### `tori/`

记录 Tori 主产品和控制平面的需求、设计、约束和执行计划。

### `tori-proxy/`

记录 Tori Proxy 的 provider auth、credential、token refresh、provider data-plane 和 external connect 相关内容。

### `bot/`

记录 Bot runtime、外部平台接入、命令转发、平台渲染和投递执行相关内容。

### `protocol/`

记录跨 Tori、Tori Proxy、Bot 的协议。协议本身是一个独立 domain，不应埋在其他 domain 的 `design/` 中。

### `global/`

只记录全局性内容，例如系统地图、全局工程规则、跨 domain 约束和文档规范。能归属到具体 domain 的内容，不放入 `global/`。

## Domain Internal Structure

每个 domain 内部使用同一套单数目录名：

```txt
<domain>/
├── README.md
├── requirement/
├── design/
├── constraint/
└── exec-plan/
    ├── active/
    └── completed/
```

### `README.md`

作为 domain 入口，说明该 domain 的职责范围、主要文档入口和相关 protocol。

### `requirement/`

记录该 domain 的需求，包括用户需求、系统能力需求、验收标准和明确的 non-goal。

`requirement/` 描述要解决什么问题，不描述最终实现细节。

### `design/`

记录该 domain 的产品设计、架构设计、领域模型、API 设计和已接受的目标实现方式。

`design/` 可以包含产品视角和实现视角，但每篇文档应在标题或开头说明自己的设计对象，避免把需求、约束和执行计划混写在同一文档中。

`design/` 应描述目标状态或已经接受的设计，不作为代码入口索引、实现审计或迁移记录。设计文档应优先包含：

- 核心数据关系。
- 状态流或生命周期。
- 权限边界。
- 与 protocol/constraint 的链接。

代码路径、当前实现差距、临时兼容方案和待办清单应放入对应 domain 的 `exec-plan/active/`、`exec-plan/completed/` 或专门的 reference 文档；不要混入 design 正文。

### `constraint/`

记录该 domain 必须长期遵守的约定、规范和边界。

适合放入 `constraint/` 的内容包括：

- ownership rule
- dependency direction
- permission rule
- protocol compatibility rule
- resource lifecycle ownership
- API / DTO shape 约定
- module boundary
- forbidden dependency or forbidden ownership

`constraint/` 描述必须遵守什么，不描述一次性执行步骤。

### `exec-plan/`

记录局限于该 domain 的执行计划。

```txt
exec-plan/
├── active/
└── completed/
```

- `active/` 放仍在执行或准备执行的计划。
- `completed/` 放已经完成的计划和执行记录。

跨多个 domain 的计划应放入 `docs/exec-plans/`，或在相关 domain 的 `exec-plan/` 中互相引用。不要在多个 domain 中复制同一份跨域计划正文。

## Content Rules

- 当前架构、需求、约束和历史执行记录必须分开。
- `design/` 不保存历史流水账；历史执行过程放入 `exec-plan/completed/`。
- `constraint/` 不保存临时计划；临时计划放入 `exec-plan/active/`。
- `requirement/` 不写实现方案，除非该实现方式本身是需求约束。
- protocol 相关文档优先放入 `protocol/` domain；其他 domain 可以链接 protocol，但不要复制协议正文。
- `protocol/design/` 只记录期望协议状态，不记录当前代码入口、临时实现、兼容过渡或实现差距。
- Tori 内部 owner module lifecycle event 属于 `tori/constraint/` 或 `tori/design/`，不属于 `protocol/`。
- 资源生命周期命令属于资源 owner module；不要把 delete、disable、enable、revoke 等模块命令抽成全局 protocol。
- 不维护新旧两套并行目录。迁移到新结构后，应删除或重定向旧入口。
- `exec-plan/active/` 只记录尚未完成或正在执行的工作，不记录已经完成的迁移日志。
- `exec-plan/completed/` 是历史记录，不代表当前状态；仍有效的结论必须沉淀到当前 requirement、design 或 constraint。
