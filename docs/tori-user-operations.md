# Tori 用户可执行操作说明

本文档描述当前 Tori 中用户可以执行的操作。范围以现有 Dashboard 页面、后端 API contract、bot ingress 命令和当前业务模型为准，不把内部表结构直接当成用户能力。

## 1. 角色与入口

Tori 当前有三类主要操作入口：

- Dashboard：登录后的 Web 控制台，用于配置身份、连接、订阅、运行时和后台任务。
- Bot / Playground：模拟或真实 bot 对话入口，用于执行命令、建立身份上下文、创建订阅和查询 provider 数据。
- 外部 bot-plugin：由 bot runtime credential 调用 Tori bot ingress 与 notification delivery 协议，用户通常不直接操作，但管理员需要配置它。

Dashboard 根据用户角色展示能力：

- 普通用户可以进入 Home、Identity & Bindings、Connections、Subscriptions、Playground。
- 管理员可以额外进入 Proxy Registry、Tasks、Bot Runtime，并执行 bot instance、proxy、task 等运维操作。

## 2. Home：查看当前工作区状态与下一步

用户登录后可以在 Home 查看当前工作区是否具备完整链路。

当前 Home 会汇总：

- 身份绑定是否就绪：是否存在 active user binding。
- 外部账号连接是否就绪：是否存在 active provider connection。
- 订阅是否就绪：是否存在 active subscription。
- 最近的 binding、connection、subscription 状态摘要。

Home 会按依赖顺序给出下一步：

- 没有用户绑定时，提示进入 Playground 建立 bot 身份上下文。
- 已有身份但没有连接时，提示进入 Connections 添加外部账号。
- 已有连接但没有订阅时，提示进入 Subscriptions 创建订阅。
- 基础链路完整时，提示继续在 Playground 中验证命令和通知。

## 3. Identity & Bindings：管理 Tori 身份与外部平台身份映射

Identity & Bindings 用于处理“外部平台看到的用户/频道”和“Tori 内部用户/频道”之间的关系。

### 3.1 查看 User Binding

入口：`/binding`

用户可以查看当前系统中的 user bindings，包括：

- Tori user id。
- 外部平台，例如 `mock`、Telegram、Discord 等。
- 外部用户 id 和外部用户名。
- namespace。
- binding 来源、assurance、状态、撤销原因。
- 创建和更新时间。

User binding 表示：某个外部平台用户已经映射到一个 Tori 用户。

### 3.2 查看 Channel Binding

入口：`/binding/channels`

用户可以查看 channel bindings，包括：

- Tori 内部 channel id。
- 外部平台。
- 外部频道 id 和外部频道名。
- namespace。
- 当前负责投递的 `botPluginInstanceId`。
- binding 状态：例如 active、suspended、revoked。
- suspended/revoked reason。

Channel binding 表示：某个外部聊天室、群组或频道已经映射到一个 Tori 内部 Channel。订阅最终投递到 Tori Channel，再通过该 Channel 的 active bindings 扇出到外部平台。

### 3.3 签发绑定 Token

入口：Binding token dialog / API `POST /tokens`

用户可以签发 bind-user token，用于把 bot 侧观察到的匿名身份绑定到当前 Tori 用户。

输入：

- purpose：当前为 `bind-user`。
- subjectType：当前为 `user`。
- subjectId：目标 Tori user id。
- issuedToSurface：当前为 `bot`。
- 可选过期时间、最大使用次数、metadata。

输出：

- grantId。
- 一次性 code。
- plaintext token。
- code/token 过期时间。

### 3.4 兑换匿名 Claim

入口：API `POST /anonymous-claims/consume`

用户可以提交 claim token，把 bot 侧创建的 anonymous user claim 绑定到当前登录用户。

输出包括：

- claimSessionId。
- anonymousUserId。
- authenticatedUserId。
- resolution。

### 3.5 撤销绑定

入口：

- `POST /user-bindings/:id/revoke`
- `POST /channel-bindings/:id/revoke`

用户可以撤销 user binding 或 channel binding。撤销后，该外部身份或外部频道不再作为 active 映射参与运行时解析。

## 4. Connections：连接外部账号

Connections 用于管理数据源账号。当前主要 provider 是 Steam，同时表单也保留了 Beatsaver、Bang Dream 等直接 ID 连接入口。

### 4.1 查看连接列表

入口：`/integration`

用户可以查看自己的 connections，包括：

- provider。
- provider account id。
- provider account name/avatar。
- access mode：`public-id`、`proxy-token`、`mixed`。
- 是否通过 token-proxy。
- status：active、disabled 等。
- 是否默认连接。
- connectedAt、lastSyncedAt。

Connection 是订阅的数据源。Subscription 通过 `connectionId` 指定监听哪个外部账号的数据。

### 4.2 直接创建公开 ID 连接

入口：Add Connection dialog，选择 `Continue without token proxy`

用户可以直接输入外部账号 ID 创建连接。

当前表单支持的平台选项：

- steam
- beatsaver
- bangdream

直接连接使用：

- accessMode：`public-id`
- proxyInstanceId：`null`

适用于只需要公开 ID 即可查询的 provider 能力。

### 4.3 通过 token-proxy 连接账号

入口：Add Connection dialog，选择某个 active token proxy

流程：

1. 用户先选择 token-proxy instance。
2. Dashboard 根据该 proxy 暴露的 providers 选择 provider。
3. Dashboard 请求 Tori 后端创建 token-proxy connection session。
4. 浏览器打开 token-proxy connect popup。
5. 用户在 token-proxy UI 中选择已有 token 或创建新 token，并确认授权账号。
6. token-proxy callback 回 Tori backend。
7. Tori backend 写入 connection。
8. Dashboard 通过 BroadcastChannel / window message 接收结果并刷新连接列表。

通过 token-proxy 创建的连接用于需要 token 或私有授权的 provider 能力，例如 Steam family 订阅。

### 4.4 查看账号 Profile

入口：`GET /connections/:id/profile`

用户可以对某个 connection 获取 provider account profile。Steam 当前支持公开 profile 查询，并可返回：

- external account id。
- display name。
- avatar URL。
- profile URL。
- lastSyncedAt。
- fetchedFromNetwork。

### 4.5 禁用、删除连接

入口：

- `PATCH /connections/:id`
- `DELETE /connections/:id`
- 删除/禁用前可调用 `POST /connections/:id/action-check`

禁用 connection 表示运行时不再使用该连接。删除 connection 表示从普通列表中移除，历史 notification event 和 task run 保留。

连接失效会影响依赖它的 subscription 和 task definition。当前设计中，这类下游影响通过事件异步处理，运行时 resolver 也会拒绝 disabled/deleted connection。

## 5. Proxy Registry：管理 token-proxy 节点

入口：`/integration/proxies`

该页面当前为管理员能力。

### 5.1 查看 proxy instances

管理员可以查看已注册 token-proxy 节点，包括：

- display name。
- base URL。
- status。
- healthStatus。
- supported providers。
- lastSeenAt。

### 5.2 注册 token-proxy

入口：Add Token Proxy dialog / `POST /proxy-instances`

输入：

- name。
- baseUrl。
- credentialRef。
- metadata。

注册时 Tori 会 probe 该 proxy，读取其健康状态和 provider capabilities。

### 5.3 检查 token-proxy

入口：Inspect / probe / `POST /proxy-instances/:id/probe`

管理员可以重新探测 proxy，确认：

- healthStatus。
- supported providers。
- provider flow。

### 5.4 禁用、删除 token-proxy

入口：

- `PATCH /proxy-instances/:id`
- `DELETE /proxy-instances/:id`
- 操作前可调用 `POST /proxy-instances/:id/action-check`

禁用 proxy 会停止新的 token-proxy connect flow。删除 proxy 会从普通列表中隐藏该节点。已有连接、订阅和任务的下游处理通过事件异步完成；运行时也会拒绝 disabled/deleted proxy 上的新连接流程。

## 6. Subscriptions：创建和管理通知订阅

入口：`/notify`

Subscription 是 Tori 的通知规则。它由三个核心维度组成：

- Owner：谁拥有这条规则，当前表单默认创建用户级订阅。
- Data Source：监听哪个 connection。
- Delivery Target：通知发往哪个 Tori Channel。

Subscription 不绑定具体 bot instance。具体投递时，Notify 会通过 Channel 找到 active channel bindings，再解析每条 binding 对应的 bot instance 和 delivery endpoint。

### 6.1 查看订阅

用户可以查看订阅列表，包括：

- channel。
- connection。
- owner。
- topicType。
- topicKey。
- eventTypes。
- status。
- createdAt / updatedAt。

### 6.2 创建订阅

入口：Create Subscription dialog / `POST /subscription`

创建订阅前需要：

- 至少一个 active channel binding。
- 至少一个 active connection。

当前 UI 提供的订阅目标：

- Steam Family Library Changes
  - topicType：`steam.family`
  - topicKey：`*`
  - eventTypes：`["family.library.updated"]`
- Steam Profile Updates
  - topicType：`steam.account`
  - topicKey：`*`
  - eventTypes：`["profile.updated"]`

创建时用户选择：

1. 订阅目标。
2. 使用哪个外部账号 connection。
3. 投递到哪个已绑定频道。

当前 Dashboard 表单默认创建 `ownerType = USER` 的用户级订阅。

### 6.3 查看订阅详情和事件

入口：

- `GET /subscription/:id`
- `GET /subscription/:id/event`

用户可以查看某条 subscription 的详情，以及由它生成的 notification events。

### 6.4 启用或禁用订阅

入口：`PATCH /subscription/:id`

管理员可以把 subscription status 改为：

- active
- disabled

禁用订阅后，事件匹配和通知候选生成不应再使用该订阅。

## 7. Notification Events：查看通知投递结果

Notification Event 是投递历史，不是用户要配置的规则。

用户可以通过 subscription detail 或 notify 相关页面查看事件，包括：

- subscriptionId。
- channelId。
- botPluginInstanceId。
- deliveryEndpointId。
- channelBindingId。
- title。
- structured body。
- payload。
- status。
- sentAt。
- failedAt。
- errorMessage。
- createdAt。

通知 body 使用结构化 blocks，前端可渲染：

- heading。
- text。
- stats。
- list。
- game-grid。
- image。
- audio。

当一个 Tori Channel 有多条 active channel bindings 时，Notify 会按 binding 扇出。某条外部线路失败不应阻止同一 Channel 的其他 active bindings 投递。

## 8. Playground：模拟 bot 对话与验证端到端链路

入口：`/playground`

Playground 是当前最直接的端到端验证入口。它会创建 mock surface，包括：

- mock external user。
- mock external channel。
- mock client id。

用户可以输入 bot 命令，查看渲染后的 bot command response，并接收 notification stream。

当前 quick commands 包括：

- `/help`
- `/status`
- `/connect steam id 76561198000000000`
- `/steam account profile`
- `/steam account inventory`
- `/sub steam family`
- `/unsub steam family`

### 8.1 `/help`

列出当前注册的 bot commands。

### 8.2 `/status`

查看当前 bot 上下文状态，包括：

- 当前身份是 anonymous 还是 claimed。
- userBindingId。
- channelBindingId。
- 当前 active connection。
- pending claim session。
- 当前 channel 的 active subscription 数量。

### 8.3 `/claim`

为当前 bot 上下文签发 claim。返回：

- claimSessionId。
- anonymousUserId。
- code。
- token。
- replacedPendingClaimSessionId。

用户随后可以在 Dashboard 或通过 `/bind` 完成绑定。

### 8.4 `/bind <token>`

消费 binding grant，把当前 bot 侧身份绑定到目标 Tori 用户。

执行后 bot context 会刷新，并返回 identity 是 anonymous 还是 claimed。

### 8.5 `/connect steam id <steamId 或 vanity>`

通过公开 Steam ID 或 vanity 创建 Steam public-id connection。

成功后会：

- 创建或复用 Steam connection。
- 把该 connection 标记为该用户 Steam provider 的默认连接。
- 返回 connectionId、providerAccountId、accessMode。

该命令只支持：

- provider：`steam`
- mode：`id`

### 8.6 `/steam account profile`

使用当前上下文解析到的 active Steam connection 获取公开 profile。

如果没有 connection，会返回缺少连接的状态。

成功时返回：

- connectionId。
- steamId。
- personaName。
- profileUrl。

### 8.7 `/steam account inventory`

使用当前上下文解析到的 active Steam connection 查询用户库。

成功时返回：

- connectionId。
- totalCount。
- matchedCount。
- 前 10 个 game items。

### 8.8 `/sub steam family`

为当前 bot channel 创建或恢复 Steam family subscription。

要求：

- 当前 bot context 有 user binding。
- 当前 channel 有 channel binding。
- 用户存在 active Steam connection。
- Steam family 订阅需要 token connection，不能只依赖 public-id connection。

支持 options：

- owner：指定订阅归属，支持 USER 或 CHANNEL 语义。
- event：指定 family event，默认 `family.library.updated`。

结果可能是：

- created。
- reactivated。
- already-active。
- invalid-target。
- invalid-owner。
- invalid-event。
- requires-token-connection。

### 8.9 `/unsub steam family`

禁用当前上下文匹配到的 Steam family subscription。

结果可能是：

- disabled。
- already-disabled。
- not-found。
- invalid-target。
- invalid-owner。
- invalid-event。
- requires-token-connection。

## 9. Bot Runtime：管理外部 bot-plugin 运行时

入口：`/bot-instances`

该页面当前为管理员能力。

### 9.1 查看 bot instances

管理员可以查看 managed bot instances，包括：

- platform。
- namespace。
- instanceKey。
- displayName。
- callbackMode。
- deliveryEndpointId。
- status。
- lastSeenAt。

### 9.2 创建 bot instance

入口：Create Bot Instance dialog / `POST /instances`

输入：

- platform。
- namespace。
- instanceKey。
- displayName。
- capabilities JSON。
- delivery endpoint kind：webhook 或 internal。
- endpoint target。
- endpoint secret。
- endpoint config JSON。

创建后 Tori 会返回 plaintext runtime credential。该 credential 只展示一次，外部 bot-plugin 后续使用它调用 Tori。

### 9.3 轮换 credential

入口：`POST /instances/:id/rotate-credential`

管理员可以为 bot instance 轮换 runtime credential。轮换后旧 credential 不应继续使用，外部 bot-plugin 需要更新部署配置。

### 9.4 禁用、撤销、删除 bot instance

入口：

- `PATCH /instances/:id`
- `POST /instances/:id/revoke`
- `DELETE /instances/:id`
- 操作前可调用 `POST /instances/:id/action-check`

禁用或删除 bot instance 会使其 runtime credential auth 和 notification delivery 停止。按当前资源生命周期设计，bot instance 是可替换基础设施，不能直接摧毁 subscription；受影响的 channel bindings 会进入 suspended 或非 active 状态，等待新 bot 接管。

### 9.5 绑定 delivery endpoint

入口：`POST /instances/:id/attach-endpoint`

管理员可以调整 bot instance 使用的 delivery endpoint。Notification delivery 会依赖该 endpoint 执行外部投递。

## 10. Tasks：管理后台任务

入口：`/tasks`

Task 是后台工作单元，当前为管理员/运维能力。

### 10.1 查看 task definitions

管理员可以查看自己的 task definitions，包括：

- kind。
- enabled。
- schedule。
- payload。
- lastTriggeredAt。
- lastRunAt。
- lastRunStatus。
- lastError。
- metadata。

### 10.2 创建任务

入口：`POST /tasks`

输入：

- kind。
- enabled。
- schedule：cron 表达式。
- payload。
- metadata。

### 10.3 更新任务

入口：`PATCH /tasks/:id`

可更新：

- enabled。
- schedule。
- payload。
- metadata。

### 10.4 删除任务

入口：`DELETE /tasks/:id`

删除后 task definition 从普通任务列表中移除，历史 task runs 保留用于诊断。

### 10.5 手动触发任务

入口：`POST /tasks/:id/run`

用户可以手动触发某个 task definition。后端会创建 taskRunId，并写入 outbox event，由后台执行器消费。

返回：

- taskRunId。
- outboxEventId。

### 10.6 查看任务运行历史

入口：`GET /tasks/:id/runs`

管理员可以查看 task runs，包括：

- status。
- scheduledFor。
- startedAt。
- finishedAt。
- errorMessage。
- summary。

## 11. Auth：登录、注册与退出

当前 Dashboard 提供：

- sign up 页面。
- sign in 页面。
- Dashboard 侧边栏 sign out。

未登录用户访问 Dashboard 会被重定向到 sign-in。

## 12. 当前操作链路总览

一个普通用户完成完整 Tori 使用链路通常是：

1. 登录 Dashboard。
2. 进入 Playground，让 bot 创建或识别当前外部 user/channel context。
3. 通过 `/claim` 和 `/bind`，或 Dashboard binding token，把外部用户绑定到 Tori 用户。
4. 进入 Connections，添加 Steam 等外部账号：
   - public-id 连接用于公开数据查询。
   - token-proxy 连接用于需要授权 token 的能力。
5. 确认或刷新账号 profile。
6. 确认存在 active channel binding。
7. 进入 Subscriptions 创建订阅，选择数据源 connection 和投递目标 channel。
8. 等待 provider 事件或后台任务产生 notification。
9. 在 Playground、subscription detail 或 notification event 历史中确认投递结果。

管理员/运维者的补充链路是：

1. 注册和 probe token-proxy。
2. 创建 bot instance 和 delivery endpoint。
3. 把 runtime credential 配置给外部 bot-plugin。
4. 观察 bot lastSeen、channel bindings、notification events 和 task runs。
5. 对 proxy、connection、bot instance、task 进行 disable/delete 前先查看 action impact。
6. 通过 credential rotation、endpoint attach、binding suspension/recovery 修复运行时问题。
