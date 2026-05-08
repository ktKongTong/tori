# Tori Dashboard UX 整改计划

这份计划用于启动一轮独立的 Dashboard UX 整改。它承接 `docs/dashboard-user-stories.md` 的产品故事，但关注执行顺序、界面结构、验收标准和落地边界。

## 背景

当前 Tori Dashboard 已经有基本路由、表格、查询和少量操作，但整体仍像后台数据表集合。用户需要自己在 Identity、Connections、Subscriptions、Tasks、Playground 等页面之间推断因果关系，才能知道系统是否已经可用、哪里失败、下一步该做什么。

这轮整改的目标不是美化表格，也不是先做宏大的流程重构。当前更基础的问题是信息表达本身没有被设计：表格列的主次关系、详情入口、时间显示、状态解释、空状态、动作位置都还停留在“把字段排出来”的阶段。这个问题不是少数几张表的问题，而是所有表格、日志列表、详情历史、token registry、bot runtime 等列表型界面共同的问题。必须先提取可复用的表格信息基建，再让各页面按自己的业务语义接入；不能在每个页面继续临时手写一套字段排列。

## 现状问题

### 1. 表格只是字段排列，不是信息设计

当前表格和列表型界面普遍缺少“这行记录对用户意味着什么”的主信息结构：

- 首列不稳定，有时是对象主标签，有时是内部类型或次要字段。
- 列顺序经常按数据结构自然展开，而不是按用户判断顺序排列。
- 详情入口被放进 actions menu，导致查看详情像一个低频操作，而不是对象本身的自然导航。
- 状态列只显示短标签，没有解释影响、freshness、失败原因或下一步。
- 时间字段如果直接展示 ISO/RFC 字符串，会增加阅读成本，不能帮助用户判断“刚刚、今天、过期、很久没更新”。
- 表格缺少 primary/secondary metadata 的层次，导致有用信息和内部噪音占同等权重。
- `apps/tori` 和 `apps/tori-token-proxy` 各有一套 Dashboard table 组件，能力不一致。token proxy 的 `columns: string[]` + `rows: ReactNode[][]` 结构尤其容易固化“字段矩阵”，不利于主对象、详情入口、状态、时间、空状态等通用规则复用。

### 2. 首页仍然是状态摘录，不是任务控制台

当前首页有 metrics、next step、recent activity 和 watchouts，但它还没有形成真正的 setup/check health 工作台：

- setup step 没有完整依赖链状态。
- watchouts 只列出计数缺口，没有解释影响范围。
- recent activity 是横向摘要，不是可追踪的工作流历史。
- 管理员健康问题与普通用户 setup 问题没有清晰分层。

### 3. 页面主要围绕表格，而不是对象详情

Bindings、Connections、Tasks 等页面主要是 action bar 加 table。表格能展示记录，但无法回答用户真正关心的问题：

- 这个 connection 是否真的可用于命令和通知？
- 这个 binding 映射的是谁，是否还能操作？
- 这个 subscription 依赖哪些 connection/channel/bot instance？
- 这个 task 失败会影响哪些订阅或功能？

### 4. 空状态缺少下一步

多个页面的 empty 文案只说明没有数据，例如 “No provider connections available.”。这类空状态无法告诉用户：

- 为什么这会阻塞当前工作流。
- 应该先去哪个页面或执行哪个动作。
- 当前缺失是用户未设置、系统异常，还是权限不足。

### 5. 状态模型过粗

当前 UI 常用 active、failed、enabled 等单点状态。Dashboard 需要区分更多对用户有意义的状态：

- 未设置：还没有完成依赖。
- 等待中：claim、sync、delivery 或 task 正在进行。
- 可用：当前对象可参与工作流。
- 过期：曾经可用，但 freshness 不达标。
- 不健康：外部 proxy、token、bot instance 或 endpoint 有问题。
- 禁用：对象存在但不参与运行。
- 失败：最近执行失败，需要恢复动作。

### 6. 内部概念暴露过早

普通用户不应该先看到 task kind、topic key、opaque id、handler、raw JSON 等内部概念。它们可以保留在管理员或 detail 的次级区域，但默认层级应优先显示：

- 人能识别的账号、频道、bot instance、provider、订阅目标。
- 当前对象对完整通知链路的影响。
- 可执行动作和可读错误。

### 7. 诊断能力分散

管理员需要从 tasks、notification events、bot instances、connections、proxies 中拼接系统健康状态。当前没有统一的运维视角来回答：

- 哪些失败正在影响用户？
- 哪个失败最紧急？
- 失败由用户设置缺失、provider 维护问题，还是系统运行时问题导致？
- 谁应该处理，处理入口在哪里？

## 设计方向

Tori Dashboard 应该是一个安静、密集、面向运维和配置工作的产品控制台。它不需要营销式视觉表达，也不应该把所有内容包装成卡片墙。视觉目标是：

- 信息密度高，但层级清楚。
- 主操作稳定可预期，减少用户猜测。
- 状态、影响、下一步动作始终同屏出现。
- 普通用户视图隐藏内部细节，管理员视图保留诊断深度。
- 页面使用工作流、对象详情和活动时间线组织信息，而不是平铺 CRUD 表。

## 目标用户

### 工作区成员

完成身份绑定、连接外部账号、创建订阅、验证通知。他们需要知道“我现在能不能用”，不需要理解内部任务系统。

### 工作区运维者

管理 bot runtime、provider proxy、delivery endpoint、后台任务和通知投递。他们需要快速定位不健康对象、影响范围和恢复动作。

### Provider 维护者

验证 provider adapter、profile、refresh task、subscription target 和 bot command 是否接入正确。他们需要 provider-specific 诊断，但不希望通用 Dashboard 被 Steam 细节污染。

### 外部 Bot 开发者

调试 bot ingress command、身份解析、业务返回和平台渲染。他们需要知道失败发生在认证、身份解析、命令校验还是业务执行。

## 北极星体验

用户打开 Dashboard 时，页面应该直接回答三个问题：

1. 当前工作区是否已经具备完整 bot/notification 运行链路？
2. 如果没有，缺哪一步，下一步要做什么？
3. 如果有异常，它影响了哪些对象，谁应该处理，入口在哪里？

## 基础整改范围：表格、列表与信息表达

在做 Home、对象详情和流程重构之前，先统一 Dashboard 的表格和列表信息设计。表格不是数据导出视图，它是用户进入对象、判断状态、采取行动的主要工作界面。

整改范围包括但不限于：

- `apps/tori`：user bindings、channel bindings、claim sessions、connections、proxy registry、subscriptions、delivery events、subscription delivery history、tasks、task run history、bot instances。
- `apps/tori-token-proxy`：recent connections、recent logs、request logs、refresh logs、token registry。
- 后续新增的 dashboard 列表、history、audit、activity、diagnostic views。

这些界面都要先经过同一套信息分类：哪些是通用列表基建能解决，哪些是领域语义需要页面自己处理，哪些只是短期过渡方案。

### 通用基建与页面临时方案边界

应抽成通用基建的问题：

- 主对象列：统一渲染对象标题、链接/详情入口、次级 metadata。
- 时间显示：统一相对时间、本地短时间、精确时间 tooltip、空值语义。
- 状态/健康摘要：统一严重性、状态文字、原因、影响摘要。
- 空状态：统一缺失原因、影响、主操作、次级入口。
- Actions menu：统一只承载命令，不承载唯一导航入口。
- 表格容器：统一密度、横向滚动、列对齐、移动端退化策略。
- 列定义 helper：帮助页面声明 primary column、status column、time column、actions column，而不是每个页面重新拼 JSX。

可以先用页面临时方案解决的问题：

- 某个 provider 的专属字段解释。
- 某个页面还没有 detail route，只能临时打开 sheet。
- 某个业务 label 当前 query 缺失，只能先用已有字段组合。
- 一次性迁移阶段的兼容字段展示。
- 日志类页面在还没有结构化事件模型前的临时摘要列。

不能继续作为临时方案的问题：

- 每页自己格式化时间。
- 详情入口只放在三点菜单。
- 首列展示内部类型、ID 或低价值字段。
- 空状态只是一句 “No records available.”。
- 状态只渲染 raw enum badge。
- token proxy 继续使用字符串列矩阵作为长期表格 API。

### 表格行的基本结构

每一行都应该遵循稳定结构：

- 主对象列：首列必须是这行记录的人类可读主对象，并承担详情导航。
- 次级摘要：主对象列内可以包含一到两条关键元信息，例如 provider、channel、external account、last activity。
- 状态与健康：状态列展示可用性和影响，不只是 raw status。
- 时间线索：时间字段使用相对时间和必要的绝对时间补充，例如 “刚刚”、“12 分钟前”、“今天 14:32”、“2026-05-05 18:10”。完整 ISO/RFC 字符串只放在 tooltip、detail 或复制入口。
- 关键关系：只保留能帮助用户判断影响的关联对象，例如 connection、channel、bot instance、subscription。
- 行内主动作：高频动作直接可见，危险动作和低频动作进入 menu。
- 详情入口：对象主标签应是链接或可点击 row title，不应该只藏在 action button 里。

### 列排序原则

列顺序必须服务用户判断，而不是服务后端字段顺序：

1. 用户识别对象的主标签。
2. 当前状态或健康。
3. 最关键的关联对象或影响范围。
4. 最近活动、更新时间或 freshness。
5. 高频动作。
6. 次级诊断字段。

内部 ID、raw type、topic key、handler、payload、cron expression、provider-specific raw fields 默认不进入主表格。它们可以出现在 detail、tooltip、debug drawer 或管理员展开区域。

### 详情入口原则

查看详情是对象列表的核心路径，不是 actions menu 的附属项：

- 有 detail route 的对象：主标签使用 `<Link>`。
- 暂时只有 sheet/detail panel 的对象：主标签或整行主区域触发打开详情。
- Actions menu 只放命令：refresh、disable、rotate、revoke、reuse、delete。
- “Details”、“View history” 这类导航项不应作为唯一入口藏在三点菜单里。

### 时间显示原则

时间信息要帮助用户判断时效，而不是证明系统存了一个 timestamp：

- 主表格优先显示相对时间或本地短时间。
- 对 freshness 重要的对象，要把时间翻译成状态，例如 “profile 2 天未同步”、“bot 18 分钟未 seen”。
- 精确时间放在 tooltip/detail 中，必要时提供复制。
- 空时间要解释语义，例如 “Never run”、“No delivery yet”、“Profile not fetched”，不要只显示破折号。

### 状态显示原则

状态必须表达影响：

- `active` 不是充分信息。需要说明 active 但 profile 缺失、active 但 proxy 不健康、enabled 但 never run。
- `failed` 需要伴随失败原因摘要和下一步动作。
- `disabled` 需要说明是用户选择、管理员停用，还是系统保护性禁用。
- 状态色只表达严重性，不替代文字。

### 当前页面的问题分布

这些不是孤立示例，而是当前列表体系的普遍症状：

- Bindings：`User Name`、`Platform`、`External User Name` 被平铺，但缺少“Bot 在哪个平台看到谁，映射到 Tori 哪个用户”的一句话式主信息。
- Channel Bindings：channel、platform、external channel、bot instance 都是关系字段，当前没有主对象摘要，也没有解释这个 channel binding 是否可用于订阅投递。
- Claim Sessions：anonymous user、observed user、observed channel、purpose、status 平铺；缺少是否可 redeem、何时过期、下一步动作。
- Connections：首列 `Account` 是合理方向，但 profile、proxy、default、status 平铺后没有告诉用户这个 connection 是否可用于命令和通知；profile 缺失应该是健康问题，不只是一个普通列值。
- Proxy Registry：`baseUrl`、providers、health、status 都有用，但缺少“这个 proxy 当前能服务哪些连接/能力”的摘要；inspect 也不应只是 action menu 项。
- Subscriptions：详情入口在 actions menu 里的 `Details`，主对象 `Channel Binding` 没有承担导航；`topicType / topicKey` 作为主表格字段太内部，应该转换成订阅目标标签。
- Delivery Events：`createdAt`、`sentAt`、`failedAt` 直接作为字符串或拼接文本展示；失败原因、投递目标、subscription 影响没有被组织成结果摘要。
- Tasks：`Task` 首列直接展示 `kind`，这是内部任务类型，不是业务标签；`View history` 不应只藏在 action menu，task label 应该链接到详情。
- Task Runs：run history 仍在展示 created、scheduled、started、finished 多个原始时间列，缺少 duration、result、freshness、失败原因摘要。
- Bot Instances：credential rotated、last seen 直接展示原始时间；endpoint、credential、runtime health 没有合并成可判断的运行状态。
- Token Proxy Recent Connections / Token Registry：provider、user、label、permissions、status、last used、token 平铺；token preview 这种低频诊断字段占据主表格位置。
- Token Proxy Request/Refresh Logs：时间、connection id、route、method、status、target/error 平铺；日志类列表可以保留诊断密度，但仍需要主事件摘要、人类可读时间和错误优先级。

## 信息架构调整

### Home

定位：工作流总览和健康入口。

应包含：

- Setup checklist：身份识别、账号连接、profile 验证、频道绑定、订阅、测试通知。
- Health inbox：按影响和 owner 排序的异常，不健康项优先于总数。
- Recent outcomes：最近有意义的 delivery、command、task、connection sync，而不是表格记录摘录。
- Role-aware actions：普通用户看到 setup 和测试动作，管理员看到诊断和恢复动作。

### Identity & Bindings

定位：解释 bot 看到的外部身份如何映射到 Tori 身份。

应包含：

- User binding、channel binding 和 claim session 的统一身份视角。
- Claim session detail：平台身份、目标用户、过期时间、是否可 redeem、失败原因。
- 从空状态直接进入 Playground 或 redeem token。
- 已知 display name 优先，opaque id 降级到次级信息。

### Connections

定位：外部账号连接与 profile 健康。

应包含：

- Connection list 以账号/profile 为主对象。
- Inline 或 side panel detail：profile、token/proxy health、owner、last sync、provider actions。
- 缺 profile、过期、proxy unhealthy、owner mismatch 的差异化状态。
- Provider-specific 操作收敛在 connection detail 内。

### Subscriptions

定位：把频道订阅到有意义的事件，并验证投递可信度。

应包含：

- 创建订阅 wizard：先选目标场景，再选 channel、connection、topic。
- 不可用选项要说明依赖缺失原因。
- Subscription detail：依赖对象、delivery history、最近事件、测试投递入口。
- Notification body preview 使用客户端一致的结构化 block 渲染。

### Bot Runtime

定位：管理 bot instance、credential 和 delivery endpoint。

应包含：

- Instance health：last seen、callback mode、endpoint、credential 状态。
- Credential 创建、轮换、撤销的显式流程。
- Endpoint 修改前说明下游影响。
- 关联 channel bindings、subscriptions 和 notification events。

### Tasks

定位：后台工作监控，不属于 Notify。

应包含：

- Task label 面向业务，例如 “Steam family library refresh for <connection>”。
- Last run、freshness、schedule、enabled state、last error。
- Detail 中展示 run history、依赖对象和影响范围。
- 合法 global task 不应因为没有 connectionId 被弱化或隐藏。

### Playground

定位：命令调试器。

应包含：

- Request builder：选择 bot instance、platform user、channel、command、参数。
- Resolution panel：resolved user、channel、binding、connection。
- Result panel：business result、rendered preview、错误分类。
- 失败时给出下一步：创建 binding、连接账号、调整 command 参数、检查 bot credential。

## 分阶段计划

### Phase 0：全量列表审计与抽取边界

目标：先不要逐页修 UI。先把所有列表型界面盘清楚，判断哪些问题应该沉淀成基建，哪些只需要页面局部改，哪些暂时受 query/API 限制。

任务：

- 为 `apps/tori` 和 `apps/tori-token-proxy` 的全部表格/列表建立审计表。
- 标注每张表的用户任务、主对象、首列、详情入口、状态列、时间列、动作列和内部字段。
- 把 “Details”、“View history” 从 action menu 的唯一入口改为主对象链接或行标题入口。
- 建立统一时间显示规则：相对时间、本地短时间、tooltip 精确时间、空时间语义。
- 建立列优先级规则：主对象、健康/状态、关键关系、freshness/最近活动、动作、次级诊断。
- 标出哪些列应该合并成主对象摘要，哪些列应该移到 detail/debug。
- 明确每张表缺少哪些 display label、health summary、human-readable time 或 detail route。
- 对每个问题打标签：`foundation`、`page-local`、`temporary`、`query-gap`。
- 明确 token proxy 是否复用主 dashboard 表格基建，或者先通过 adapter 过渡。

产出：

- 表格列设计审计表。
- 基建抽取清单。
- 页面局部修复清单。
- 临时方案清单和退出条件。
- `DashboardTable` / column helper / token-proxy table adapter 的改造清单。
- 各页面 frontend-only 调整清单。
- query/API 缺口清单，仅记录真正阻塞人类可读展示的字段。

验收：

- 每个列表型界面都被纳入审计，不只覆盖三四张主表。
- 每类问题都明确是基建、页面局部、临时方案还是 query gap。
- 基建任务优先级高于逐页美化。
- 临时方案都有退出条件，不能永久沉淀成第二套表格习惯。

### Phase 1：表格组件与基础信息组件基建

目标：把 Phase 0 识别出来的通用问题沉淀到共享组件中，避免每个页面继续手写低质量表格。

任务：

- 统一 `apps/tori` 和 `apps/tori-token-proxy` 的表格能力，至少提供同一套信息 primitive；token proxy 不应长期停留在 `columns: string[]` + `rows: ReactNode[][]`。
- 扩展 `DashboardTable`，支持对象主列、row link/detail trigger、row action density、empty state 插槽、列 meta。
- 新增或整理 `DashboardObjectLink`，统一主对象链接、标题、次级 metadata、可选 description。
- 新增 `DashboardTime`，统一相对时间、短时间、精确时间 tooltip 和空值语义。
- 新增 `DashboardHealthSummary`，表达健康、影响和原因，不只渲染 badge。
- 新增 `DashboardFieldList` 或 `DashboardMetadata`，把次级诊断字段从主表格中移出。
- 明确 actions menu 的使用边界：只放命令，不放唯一导航入口。
- 提供 column helper，例如 `objectColumn`、`statusColumn`、`timeColumn`、`actionsColumn`，让页面声明语义而不是重复 JSX。

验收：

- 新增列表默认使用基建 primitive，而不是从零拼 `ColumnDef` 或 `ReactNode[][]`。
- 主对象、时间、状态、空状态、actions 的通用行为可复用。
- token proxy 有明确迁移路径，不继续复制一套弱表格。
- 基建不编码具体业务语义；业务 label、影响关系、provider-specific 说明仍由页面或 query 提供。

### Phase 2：全量列表接入基建

目标：把所有列表按审计结果接入通用基建，同时保留少量有明确退出条件的页面临时方案。

任务：

- 第一批：Connections、Subscriptions、Tasks、Bot Instances、Delivery Events。
- 第二批：Bindings、Channel Bindings、Claim Sessions、Proxy Registry、Task Runs。
- 第三批：token proxy recent connections、token registry、request logs、refresh logs。
- 每批改造都处理主对象列、详情入口、时间、状态、空状态、actions menu 边界。
- 对 query 缺口只做最小必要补充，不在 UI 中继续堆内部字段补洞。

验收：

- 所有 dashboard 表格都有稳定主对象首列。
- 详情入口不再只依赖 actions menu。
- 时间字段不再直接暴露 ISO/RFC 字符串作为默认展示。
- 内部字段不占据主表格高优先级位置。
- 空时间、缺 profile、never run、no delivery、not fetched 等状态都有语义化文案。
- 日志类表格即使保留高密度，也有主事件摘要和人类可读时间。

### Phase 3：Home 改造成工作流入口

目标：让用户不用点击侧边栏也能知道设置链路还缺什么。

任务：

- 把当前 metrics 改为 dependency-aware setup checklist。
- 引入 role-aware health inbox，普通用户和管理员分层展示。
- Watchouts 改为 “issue + impact + owner + action”。
- Recent activity 改为最近 outcome 时间线。
- 空/加载/错误状态必须可操作。

验收：

- 全新用户能从 Home 进入正确的第一步。
- 已完成设置的用户能看到测试命令或测试通知入口。
- 管理员能优先看到失败投递、不活跃 bot、过期 connection、失败 task。

### Phase 4：对象详情与上下文动作

目标：把核心表格升级为 list + detail/action 的控制台模式。

任务：

- Connections 增加 connection detail panel。
- Subscriptions 完善 detail：依赖、delivery history、body preview、test delivery。
- Tasks detail 增加 impact、业务 label、freshness 和恢复动作。
- Binding/claim detail 解释身份映射、状态和 redeem 可用性。
- 表格行主标签全部使用 display label，内部 id 降到 expandable detail。

验收：

- 用户能从任意核心对象看到它的健康、影响和下一步。
- 失败状态不再只显示 raw error，而是有恢复建议。
- 普通用户默认不需要复制内部 ID 完成主流程。

### Phase 5：引导式创建流程

目标：减少用户手填内部字段，把配置动作从“创建记录”改成“完成目标”。

任务：

- Subscription dialog 改为 wizard：目标、频道、连接、确认。
- 不可用 target/channel/connection 显示缺失原因和跳转动作。
- Claim redeem、connection profile refresh、test delivery 引入一致的确认和结果反馈。
- Playground 和 setup checklist 可以带上下文跳转到创建流程。

验收：

- 创建订阅不要求用户理解 topic type/key 的内部含义。
- 缺依赖时，用户在提交前已经知道原因。
- 创建成功后，用户能立即验证 delivery 或看到下一步。

### Phase 6：运维健康与影响模型

目标：让管理员能从 Dashboard 中处理生产问题，而不是脑内 join 多张表。

任务：

- 定义统一 health issue 模型：severity、owner、impacted objects、source object、recommended action。
- Home 增加 admin health inbox。
- Bot Runtime、Tasks、Connections、Subscriptions 增加关联对象和影响范围。
- Notification failures、task failures、proxy unhealthy、bot inactive 归一到可操作 issue。

验收：

- 管理员能按严重程度处理异常。
- 每个异常都链接到相关对象和动作。
- 页面能区分用户设置未完成与系统运行不健康。

### Phase 7：视觉系统与交互统一

目标：在不改变产品语义的前提下，提高可读性、一致性和专业感。

任务：

- 收敛 Dashboard shared components：page header、section header、empty state、status marker、detail panel、timeline、issue row、object summary。
- 减少无意义 card 包裹，改用 full-width sections、lists、details 和 panels。
- 建立状态色和 severity 规则。
- 检查 mobile/tablet 下的 sidebar、table、detail sheet 和 wizard。
- 清理文案：所有页面都使用用户目标、业务标签和下一步动作。

验收：

- 页面结构一致，但不会所有内容都变成相同卡片。
- 状态、动作、次级信息的视觉权重稳定。
- 关键表格和 detail 在窄屏下不遮挡、不溢出。

## 共享组件建议

优先新增或重构以下 UI primitive，而不是在页面里复制布局：

- `DashboardTable`：统一主表格能力，支持列 meta、主对象列、详情入口、empty state、actions 边界和响应式策略。
- `createDashboardColumns` / column helpers：用语义声明 object/status/time/actions 列，减少页面重复拼 JSX。
- `DashboardObjectLink`：主对象标题、详情链接、次级 metadata、可选状态摘要。
- `DashboardTime`：相对时间、本地短时间、精确时间 tooltip、空值语义。
- `DashboardHealthSummary`：健康状态、原因、影响和下一步摘要。
- `DashboardTableEmptyState`：表格级空状态，包含缺失原因和下一步动作。
- `DashboardMetadata`：承载内部 ID、token preview、raw type、handler、payload summary 等次级诊断信息。
- `DashboardLogSummary`：日志类列表的主事件摘要，避免日志表继续只按字段横向展开。
- `DashboardPageHeader`：标题、说明、主操作、次级操作。
- `DashboardEmptyState`：缺失原因、影响、主操作、次级链接。
- `DashboardSetupChecklist`：依赖步骤、状态、动作。
- `DashboardIssueList`：severity、owner、impact、action。
- `DashboardObjectSummary`：对象主标签、状态、关键元数据。
- `DashboardDetailPanel`：稳定的 side panel/detail layout。
- `DashboardTimeline`：最近 outcome，不直接展示 raw event。
- `DashboardStatusMarker`：比单一 badge 更明确的状态表达。

## 文案规则

- 页面文案先回答“这会影响什么”，再展示内部字段。
- Empty state 必须包含下一步动作。
- Error state 必须说明用户可做什么，不能只说 failed。
- 普通用户默认不显示 raw JSON。
- 管理员可在 detail 中展开内部 ID、payload、task kind、handler 等诊断信息。
- Provider-specific 文案放在 provider action/detail 中，通用页面不出现 `steam*` 作为通用概念。

## 验收总标准

本轮整改完成后，Dashboard 应满足：

- 用户能从 Home 完成首次设置，不需要遍历侧边栏猜顺序。
- 每个核心对象都有健康、影响和下一步动作。
- 每个空状态和失败状态都可操作。
- 普通用户视图不被内部实现词汇打断。
- 管理员能看到按优先级排序的系统健康问题。
- Provider-specific 细节不污染通用平台概念。
- Playground 能解释 command 调试链路，而不是只提交任意请求。
- 视觉系统支持高密度工作流，而不是单纯堆卡片和表格。

## 建议的第一批改动

第一批实现建议只覆盖信息表达地基，不先做大范围 workflow 重构：

1. 建立全量列表审计表，覆盖 `apps/tori` 和 `apps/tori-token-proxy` 的所有表格、历史、日志和 registry。
2. 给每个问题打标签：`foundation`、`page-local`、`temporary`、`query-gap`，先做可通用抽取。
3. 新增 `DashboardObjectLink`、`DashboardTime`、`DashboardHealthSummary`、`DashboardTableEmptyState`。
4. 改造 `DashboardTable` 和 column helper，支持主对象入口、可操作 empty state、稳定 actions menu 边界。
5. 为 token proxy 表格提供 adapter 或迁移路径，避免长期维护 `ReactNode[][]` 字段矩阵。
6. 第一批接入 Connections、Subscriptions、Tasks、Bot Instances、Delivery Events。
7. 第二批接入 Bindings、Channel Bindings、Claims、Proxy Registry、Task Runs。
8. 第三批接入 Token Proxy 的 Recent Connections、Token Registry、Request Logs、Refresh Logs。

这批改动完成后，再进入 Home setup、对象详情和更重的 backend/query health issue 模型设计。

## 开放问题

- `DashboardTable` 基建应放在 `apps/tori` 内，还是提升到 `packages/ui` 或 dashboard 专用 package 以便 token proxy 复用？
- token proxy 是否应直接迁移到 TanStack column model，还是先通过轻量 adapter 过渡？
- 是否需要为普通用户和管理员拆分默认首页，还是同一 Home 做 role-aware sections？
- Health issue 模型由 dashboard query 聚合，还是先由前端从现有数据派生？
- Notification body preview 是否已有稳定 renderer 可复用，还是需要从 bot command renderer 中抽取通用 block renderer？
- Provider connection 的 “freshness” 阈值由 provider adapter 定义，还是 dashboard 统一配置？
- Playground 的调试请求是否需要持久化为可追踪 activity？
