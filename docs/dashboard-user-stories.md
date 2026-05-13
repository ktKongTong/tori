# Tori Dashboard 用户故事

Tori Dashboard 不能只是一组 CRUD 表。它应该帮助用户完成一条完整链路：连接外部账号，确认机器人能识别身份，建立订阅，让通知稳定送达，并在异常时知道哪里断了、下一步该做什么。

这份文档定义产品级用户故事。它不是路由清单，也不是组件需求列表。每个故事都描述用户目标、进入场景、产品行为、验收标准和需要避免的粗糙实现。

## 产品体验原则

- Dashboard 应该展示系统状态，而不是数据库表状态。
- 每个页面都应该回答“现在能做什么”和“下一步应该做什么”。
- 普通用户不需要理解内部实现词汇，例如 task run、outbox、inbox、handler，除非他处在管理员诊断场景。
- Profile 是 connection detail 的一部分，不是独立资源中心。
- Task 是通用后台工作单元，不属于 notify。
- Notify 是订阅与投递体验，不是所有异步任务的垃圾桶。
- Steam 是第一个 provider，不是通用概念本身。

## 用户角色

### 工作区成员

普通用户。他希望把自己的外部账号接入 bot，并订阅自己关心的通知。这个用户不想理解系统架构，只关心是否已经连接、是否已经绑定、通知是否会到。

### 工作区运维者

管理用户或机器人运行的人。他需要确认频道、bot instance、delivery endpoint、provider proxy 是否处于健康状态。这个用户需要更强的诊断能力，但仍然不应该被迫读原始 JSON。

### Provider 维护者

接入或维护某个 provider 的开发/运维角色。他关心 provider connection、profile refresh、family refresh、task handler、事件消费是否符合平台契约。

### 外部 Bot 开发者

维护 bot-plugin 的开发者。他通过 bot ingress 调用 Tori，需要清楚命令是否注册、身份上下文是否解析成功、业务返回是否可渲染。

## 故事 1：首次使用引导

用户目标：作为工作区成员，我希望 Dashboard 告诉我在使用 bot 前还缺什么，而不是让我自己去五张表里找原因。

进入场景：

- 用户登录后打开首页。
- 用户没有未删除的 user binding。
- 用户没有 active provider connection。
- 用户没有 active subscription。

产品行为：

- 首页展示按依赖顺序排列的 setup checklist：
  1. 在 bot 场景中识别当前用户。
  2. 连接外部 provider 账号。
  3. 验证账号 profile。
  4. 创建订阅目标。
  5. 发送或预览测试通知。
- 每一步都有主操作和清晰状态：未开始、等待中、已就绪、失败。
- 如果系统已经知道下一步是什么，不应该把用户扔到一个泛用 table。

验收标准：

- 如果没有未删除的 user binding，首页主操作进入 Playground 或 binding claim flow。
- 如果已经有 binding 但没有 provider connection，首页主操作进入 Connections。
- 如果 connection 存在但 profile 缺失，首页提示用户在 connection 行或 detail panel 中获取/刷新 profile。
- 如果没有 subscription，首页进入创建订阅流程，并尽可能带入已知默认值。
- 首页 setup steps 不暴露内部 task 名称。

避免：

- 只显示“0 connections”但不解释这会影响什么。
- 让用户通过点击侧边栏每个菜单来猜设置顺序。
- 已经有 display name/profile 时，仍把原始 provider id 当主标签展示。

## 故事 2：连接健康与详情

用户目标：作为工作区成员，我希望知道自己的外部账号是否真的已连接、是否能被系统识别，从而相信后续 bot 命令和通知不会空跑。

进入场景：

- 用户打开 Connections。
- 用户完成 OAuth/proxy 流程后回到 Dashboard。
- 用户执行一个需要 provider account 的 bot 命令。

产品行为：

- Connections 页面以 connection 为主要对象。
- 账号 profile 内嵌在 connection 中展示：头像、显示名、外部账号 id、profile URL、最后同步时间。
- Provider-specific 操作收敛在 connection 下，不拆成互不相关的页面。
- 行状态或详情状态需要区分：
  - 已连接但 profile 缺失
  - profile 过期
  - token/proxy 不健康
  - owner 不匹配
  - provider 不支持当前操作

验收标准：

- 没有 profile 的 connection 有明确的“获取 profile”操作。
- profile 获取失败时展示可读原因，并保留 connection 可见。
- Steam 专用字段不泄露到通用字段名中。
- Proxy 健康状态和 provider account 健康状态在视觉上分开。
- 管理员/运维者可以在次级信息中看到 raw ids；普通用户优先看到 display name。

避免：

- 独立的 Profile table/page。
- 把 `steamId` 当成通用 dashboard 字段。
- 只用一个 “active” 状态 pill 代表所有健康信号。

## 故事 3：Bot 身份绑定

用户目标：作为工作区成员，我希望 Dashboard 解释 bot 是如何识别我和频道的，这样我可以自己修复身份问题，而不是找运维查数据库。

进入场景：

- 用户打开 Identity & Bindings。
- 用户从 Playground 运行命令。
- Bot 无法把外部 user/channel 匹配到 Tori identity。

产品行为：

- User binding 和 channel binding 应被展示成身份映射，而不是原始记录。
- Claim session 展示 bot 侧观察到的身份、目标 Tori identity、当前状态和过期时间。
- 产品需要解释什么 claim 可以安全 redeem，什么已经被使用或失效。

验收标准：

- 用户能看到“Bot 在平台 Y 上看到你是 X；Tori 将它映射到账号 Z”。
- 用户可以从相关上下文创建或兑换 claim token。
- 过期、撤销、已使用的 claim 有不同标签和下一步动作。
- Channel binding 状态展示是哪个 bot instance 观察到了该频道。

避免：

- 展示 claim session 行，却不说明是否还能操作。
- 匿名用户和真实用户在视觉上无法区分。
- 已知 display name 时仍要求用户复制 opaque id。

## 故事 4：创建订阅

用户目标：作为工作区成员，我希望把一个频道订阅到有意义的事件，这样通知会发到已经存在 bot 上下文的位置。

进入场景：

- 用户已经完成 binding 和 connection 设置。
- 用户打开 My Subscriptions。
- 用户从首页 setup next step 进入创建订阅。

产品行为：

- 创建订阅从人的目标开始，例如“让这个频道接收这个 provider/account 的事件通知”。
- 可选 target 来源于已注册的 subscription target definitions。
- 表单优先使用已知 channel binding 和 connection。
- Topic type/key 不应该像裸 backend 字段。

验收标准：

- 用户不需要手动输入内部 ID 就能创建订阅。
- UI 会说明某个 target 为什么不可用，例如缺 connection、缺 channel binding、provider 不支持。
- 创建后，subscription 行展示 channel、bot instance、connection/profile label、topic 和状态。
- 如果创建订阅时创建或复用了 refresh task，页面能说明这个结果。

避免：

- 暴露所有 backend 字段的“create row”表单。
- 把 topic 字符串作为主要用户概念。
- 直到提交才告诉用户依赖缺失。

## 故事 5：通知可信度

用户目标：作为工作区成员，我希望知道通知是否真的被投递，这样完成设置后我能相信系统在工作。

进入场景：

- 用户打开 Delivery History。
- 用户预期某个 provider 事件后应该收到通知。
- 用户测试某个 subscription。

产品行为：

- 通知历史围绕 delivery result 和受影响 subscription 组织。
- Dashboard 可以预览结构化 notification body，使用和客户端一致的 block 结构。
- 不打开 raw JSON 也能看到失败原因和投递目标。

验收标准：

- 每条 notification event 展示 title、subscription、channel、delivery endpoint、status、created time。
- 失败事件展示失败原因和建议检查的下一步。
- 通知 body preview 能渲染 heading、text、stats、list、game-grid、image、audio blocks。
- 管理员可以在次级详情中查看 raw payload。

避免：

- 把 notification event 当成普通日志。
- 在已经有结构化 body 的情况下，只展示服务端拼接文本。
- 在 event 视图中隐藏 delivery endpoint 状态。

## 故事 6：运维健康概览

用户目标：作为工作区运维者，我希望一个页面告诉我当前哪里不健康，从而在用户报告 bot 或通知坏了之前处理问题。

进入场景：

- 管理员打开首页。
- 管理员在部署后检查系统状态。
- 通知停止送达。

产品行为：

- 运维概览优先展示不健康或过期的对象：
  - 失败的通知投递
  - 不活跃的 bot instances
  - 不健康的 proxies
  - 过期的 connections/profile sync
  - 失败或 overdue 的 tasks
  - 如果已暴露 outbox/inbox backlog，也应显示
- 每个异常都直接链接到相关对象和可执行动作。

验收标准：

- 管理员能区分“用户设置没完成”和“系统健康问题”。
- 管理员先看到最近失败，而不是先看到总数。
- 健康卡片解释影响范围，例如“3 个订阅依赖这个 endpoint”。
- 每个 alert 有明确 owner：用户、运维者或 provider 维护者。

避免：

- 用一堆总数卡片冒充 dashboard。
- 健康状态和异常状态视觉权重相同。
- 让运维者靠脑内 join 表推断影响范围。

## 故事 7：Bot 运行时管理

用户目标：作为工作区运维者，我希望管理 bot instances 及其绑定的 delivery endpoint，让外部 bot plugins 可以安全调用 Tori 并接收工作。

进入场景：

- 管理员打开 Bot Runtime。
- 某个 bot plugin 需要 credential。
- 某个 bot instance 的 webhook endpoint 需要调整。

产品行为：

- Bot instance 展示身份、状态、callback mode、关联 endpoint、last seen time。
- Credential 创建/轮换必须显式且可审计。
- Delivery endpoint 作为 bot instance 的运行时配置管理，不作为独立业务页面。

验收标准：

- 管理员可以创建、撤销或查看 bot instance credential 状态。
- Instance 行展示 last seen 和 callback mode。
- Endpoint 配置变更清楚解释下游影响。
- Bot instance detail 尽可能链接相关 notification events 和 channel bindings。

避免：

- 把用户订阅管理和 bot runtime 管理混在一张表。
- 创建后继续展示 secret。
- 用 “active” 代替 last seen/health。

## 故事 8：后台任务监控

用户目标：作为工作区运维者，我希望按业务目的监控后台任务，知道刷新、同步或其他后台工作是否在运行、是否失败。

进入场景：

- 管理员打开 Tasks。
- Provider refresh 看起来过期。
- 某个 subscription 依赖后台刷新。

产品行为：

- Tasks 是通用概念。页面展示 task kind、schedule、enabled state、关联对象、last run status 和 freshness。
- Task label 应该面向业务，例如 “Steam family library refresh for <connection>”。
- Provider-specific 细节作为次级信息展示。

验收标准：

- Tasks 页面不在 Notify 下。
- 如果一个 task 没有 connectionId 但仍是合法 global task，它也应该显示。
- 失败 task 展示 last error 和 last attempted time。
- 如果存在依赖关系，管理员能看到哪些 subscriptions 或 features 依赖这个 task。

避免：

- 如果未来 task 不全是 refresh task，页面仍叫 “Refresh Tasks”。
- 过滤掉合法的非 connection task。
- 只展示 task kind，不展示业务标签。

## 故事 9：Provider 维护者工作流

用户目标：作为 provider 维护者，我希望验证一个 provider adapter 是否正确接入平台层，从而让新 provider 不需要改变通用 dashboard 概念。

进入场景：

- 维护者添加一个新 provider。
- 维护者调试 provider profile 或 refresh 行为。
- 维护者验证 bot command 和 subscription target 注册。

产品行为：

- Provider-specific 能力通过 connection actions 和已注册的 target/command metadata 暴露。
- 通用界面保持 provider-neutral。
- Debug detail 可用，但不是默认展示。

验收标准：

- 新 provider 可以通过 `getConnectionAccountProfile` 暴露账号 profile。
- 新 provider 可以通过 task handlers 暴露后台工作。
- 新 provider 可以暴露 bot commands 和 subscription targets，而不需要修改通用前端 schema 名称。
- Dashboard label 只有在标识 provider instance 时使用 provider display name，不把它当通用类型名。

避免：

- 在通用 API schema 中加入 `steam*` 字段。
- 没有用户故事就创建 provider-specific 顶级 dashboard 页面。
- 把 Steam 假设复制到 platform code。

## 故事 10：外部 Bot 开发调试

用户目标：作为外部 Bot 开发者，我希望看到一个 ingress command 为什么成功或失败，从而不需要读服务端日志也能修复 bot 集成问题。

进入场景：

- Bot command 返回错误。
- Command 需要 identity binding 或 provider connection。
- Bot instance credential 校验失败。

产品行为：

- Playground 是命令调试器，不是玩具表单。
- 它展示 resolved user、channel、bot instance、command、business result 和可渲染响应。
- 失败状态需要区分 authentication、identity resolution、command validation 和 business failure。

验收标准：

- 开发者能判断失败发生在 command dispatch 前还是后。
- Playground 分开展示 normalized business result 和 platform-rendered preview。
- 缺 binding 与缺 connection 是不同错误，并提供不同下一步。
- 如果可用，管理员可以把 playground request 和 event/log trace 关联起来。

避免：

- 一个只提交任意 JSON 的 textarea。
- 只返回 platform-specific rendered text。
- 把所有失败都折叠成 “command failed”。

## 需要补齐的产品差距

当前 dashboard 已经有表格和基本动作。要成为产品，下一层重点应补齐：

- 对象详情面：connection detail、subscription detail、bot instance detail、task detail。
- 引导式 setup：依赖感知的首次使用 checklist 和上下文空状态。
- 健康模型：区分未设置、未健康、过期、禁用、失败。
- 影响模型：展示坏掉的 connection、endpoint、bot instance 或 task 影响哪些订阅与功能。
- 渲染预览：notification body preview 和 bot command response preview。
- 活动时间线：围绕对象展示最近有意义的事件。
- 恢复动作：retry、refresh、rotate、disable、reconnect、redeem claim、test delivery。
- 文案治理：用用户目标和系统概念替换内部表名。

## 故事优先级

P0 故事：

- 首次使用引导
- 连接健康与详情
- 创建订阅
- 通知可信度
- 运维健康概览

P1 故事：

- Bot 身份绑定
- Bot 运行时管理
- 后台任务监控
- 外部 Bot 开发调试

P2 故事：

- Provider 维护者工作流
- 跨对象活动时间线
- 订阅、端点、连接和任务之间的影响图

## 完成标准

一个 Dashboard feature 达到产品级，需要满足：

- 从用户目标开始，而不是从数据库表开始。
- 有有意义的空状态。
- 展示状态、影响和下一步动作。
- 区分用户可读标签和内部 ID。
- 为正在操作的对象提供 detail view 或 inline detail。
- 失败状态能告诉用户下一步该做什么。
- 保持通用平台概念通用，provider 细节留在 provider adapter 内。
