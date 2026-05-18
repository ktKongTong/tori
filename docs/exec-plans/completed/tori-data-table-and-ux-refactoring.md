# Tori Dashboard UX & Data Table 分阶段重构计划

> Historical record: 本文是历史执行计划，不代表当前 Dashboard 状态或当前问题清单。仍有效的结论应以 `docs/tori/requirement/`、`docs/tori/design/` 和当前 active exec-plan 为准。

## 原则与共识

1. **暂避 Home 页**：当前 Home 页历史包袱过重，暂时冻结，不作为本轮重构的目标，避免陷入屎山代码的泥潭。
2. **基建下沉**：将高密度、高语义的表格基建统一实现在 `packages/data-table` 中，供 `apps/tori` 和 `apps/tori-token-proxy` 共同消费，彻底消灭无语义的 `columns: string[]` 字段拼接。
3. **对象详情为核心**：表格主列必须是详情的直接入口，告别“详情只能在右侧三个点里点开”的反人类设计。
4. **向导化表单**：打破“对着数据库结构填表”的陋习，按用户目标重组创建流程。
5. **拒绝裸奔数据**：严禁在 UI 中向用户展示 Raw JSON 等内部结构。对于 Opaque ID 等必要的次级信息，应按需轻量展示，绝不干扰界面主体。管理员排障应通过专门的运维链路（而非普通用户界面）进行。

---

## 阶段拆解

### Phase 1: 打造高阶表格基建 (`packages/data-table`)

**目标**：在 `packages/data-table` 中建立一套富含业务语义的现代数据表规范，作为后续所有列表页的底座。

- **DataTable 核心容器**：基于现有的表格库（如 TanStack Table）封装，支持灵活的列定义、空状态插槽（Empty State 必须可操作）和行级操作区。
- **语义化原子列组件 (Cell Renderers)**：
  - `ObjectLinkCell`：用于表格第一列。仅用于显示辨识度高的主标签（如 Display Name 等），**单行显示**，并包裹超链接直达详情。绝不把次级信息强行堆叠在这个 Cell 里，次级信息应平铺到其他独立列中。
  - `StatusImpactCell`：丢弃干瘪的 Enum Badge。不仅展示状态颜色，还要支持渲染影响（Impact）和下一步建议（如：`Active (Profile missing)`）。
  - `RelativeTimeCell`：主视图仅展示相对时间（“10分钟前”、“3天未同步”）以判断新鲜度，精确的 ISO 时间仅在悬浮 Tooltip 中展示。
  - `Code/IdCell`：用于渲染不可读的 Opaque ID、Token 或短摘要，提供一键复制，视觉上做弱化处理（Monospace, 浅灰色）。
- **列定义助手 (Column Helpers)**：提供一套强类型的构建工具，让各个业务页面声明列时更关注“这是个什么业务信息”，而不是写重复的 JSX 样板代码。

### Phase 2: 核心列表页套用新基建 (Core Lists Refactoring)

**目标**：用 `packages/data-table` 彻底翻新现有长得像数据库后台的页面，理顺信息优先级。

- **Connections 列表**：
  - 首列使用 `ObjectLinkCell` 展示账号名 + 头像。
  - 引入 `StatusImpactCell` 清晰区分“健康”、“无 Profile”、“Proxy 异常”等不同维度的状态。
  - 移除冗余的内部 ID 字段，放到详情中。
- **Subscriptions 列表**：
  - 首列展示人类可读的“订阅目标”（如：某 Channel 的 Steam 库存变动），而不是 `topicKey`。
  - 时间列展示“最后投递时间”。
- **Identity & Bindings (User / Channel)**：
  - 强化“映射”概念，明确展示 `Bot 平台看到的 ID -> Tori 平台对应的用户` 的对应关系。
- **Token Proxy 接入**：将 `apps/tori-token-proxy` 下的 Recent Connections / Token Registry 等弱表格页面同样迁移至新的 `data-table` 组件。

### Phase 3: 详情面板与上下文动作 (Detail-Centric & Contextual Actions)

**目标**：砍掉反直觉的全局 Action Menu，让所有的诊断、关联查看和操作收敛在对象的专属详情上下文中。

- **统一的 Detail Panel / Sheet 交互**：当用户在表格点击主列时，从侧边滑出抽屉（Sheet）或进入独立的详情页。
- **动作迁移**：将原来藏在“三点菜单”里的低频和高频操作（如 `Refresh Profile`, `Test Delivery`, `Revoke Claim`）移至详情页的显眼位置，作为 Contextual Actions。
- **诊断信息折叠**：在详情页下方提供 `Diagnostic / Developer Data` 区域，把 Raw JSON、Task ID、Handler 名称、Raw Payload 等内部数据扔进去，满足管理员排障需求，确保普通用户视野干净。

### Phase 4: 向导式创建流程 (Wizard-style Creation)

**目标**：消灭对着后台字段盲填的表单，降低用户的认知成本。

- **重构 Subscription 创建流程**：
  - 彻底隐藏内部的 `topicType` / `topicKey`。
  - 采用分步向导（Wizard）：步骤1 选择目标 (想订阅什么) -> 步骤2 选择通道 (发到哪里) -> 步骤3 绑定依赖账号 (用谁的身份)。
  - **上下文缺失阻断与引导**：在填表时如果检测到缺少前置依赖（例如当前 Channel 还没绑定），直接在表单内提供“去绑定”的跳转入口，而不是点提交后报错。

### Phase 5: 角色视图隔离与 Playground 增强 (Role & Diagnostic Enhancements)

**目标**：彻底区分“普通成员使用系统”和“开发者排查系统”的体验边界。

- **运维视图分离**：将 Bot Runtime、Global Tasks 等纯基建概念彻底归类为管理员专属区域。
- **Playground 升级为全链路调试器**：
  _ 定位为“外部 Bot 开发者”的专属调试兵器。
  _ 当 Bot 命令执行失败时，Playground 必须清晰地将其拆解归类：是“Authentication (Bot Token 错)”、“Identity Resolution (查无此人)”，还是“Business Failure (业务逻辑代码报错)”。不能再像以前那样统一抛出一个渲染后的无用文本。
  )”。不能再像以前那样统一抛出一个渲染后的无用文本。
