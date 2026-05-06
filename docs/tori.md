# Tori

Tori 是一个面向外部平台账号、机器人入口、订阅通知和后台运维的全栈应用。它把用户身份绑定、第三方连接、通知订阅、Bot 命令入口、后台任务和平台适配放在同一个业务系统里，同时保持平台能力与通用平台能力分层。

当前仓库里有两个主要应用：

- `apps/tori`：主应用，包含 Dashboard 前端、Hono API、任务/事件运行时、多运行时适配和平台模块。
- `apps/tori-token-proxy`：Token Proxy 应用，负责第三方 OAuth/Token 管理、代理实例管理、系统级刷新任务和独立部署入口。

本文主要介绍 `apps/tori`。

Dashboard 的产品级 user stories 见 [dashboard-user-stories.md](dashboard-user-stories.md)。
Bot plugin 的平台适配边界与 Telegram 样例见 [bot-plugins.md](bot-plugins.md)。

## 产品边界

Tori 的核心目标是把“外部平台账号接入后，如何被机器人、订阅、通知和任务系统消费”这条链路打通。

主要能力包括：

- 身份与绑定：维护用户绑定、频道绑定、匿名 claim session 等身份关系。
- 集成连接：管理第三方 provider 连接、代理实例，以及连接关联的账号 profile。
- 通知订阅：管理订阅、通知事件、投递端点和结构化通知内容。
- Bot 入口：提供外部 bot-plugin 调用的 ingress 协议和命令注册机制。
- Bot 运行时：管理 bot plugin instance、credential、delivery endpoint 等运行信息。
- 任务系统：管理通用 task definition / task run，并通过事件驱动执行具体 task handler。
- Dashboard：提供面向用户和管理员的操作界面，前端 feature 自己管理自己的 API schema 和 query。
- 平台适配：Steam 目前作为第一个 provider/plugin 样例，后续可以继续接入其他平台。

## 目录结构

`apps/tori` 的重要目录如下：

```txt
apps/tori
├── adapter/                  # Node / Cloudflare 等运行时适配
├── entry/                    # bun / deno / nitro / node / worker 入口
├── drizzle/                  # 数据库迁移
├── src
│   ├── api                   # Hono API、domain、repository、module
│   ├── components            # Dashboard shell 与共享 UI 组合
│   ├── features              # 前端 feature，每个 feature 管理自己的 api/query/page
│   ├── lib                   # 前端共享客户端、modal、toast 等
│   └── routes                # TanStack Router 薄路由
└── vite.config.ts
```

前端路由只负责把 URL 映射到 feature page。业务页面、列定义、请求 schema、React Query hook 都放在对应 feature 下，例如：

```txt
src/features/notify/
├── api.ts
├── query.ts
├── notify/
├── events/
└── endpoints/

src/features/tasks/
├── api.ts
├── query.ts
├── columns.tsx
└── page.tsx
```

这个组织方式的原则是：route 是壳，feature 是业务边界。不要把 dashboard API、query 或页面逻辑集中到一个 all-in-one 文件里。

## 后端分层

Tori 后端以 Hono 为 HTTP 层，核心入口是：

- `src/api/index.ts`：注册运行时能力，包括 cron、outbox、task handler、event consumer、bot command、subscription target、provider handler。
- `src/api/server/app.ts`：创建 Hono app，注册 middleware、system route、module route 和错误处理。
- `src/api/server/routes.ts`：把各业务 module 挂到 API 路径。

当前主要 API module：

```txt
src/api/modules
├── dashboard                 # Dashboard 聚合查询
├── platform
│   ├── binding               # 用户/频道绑定与 claim
│   ├── bot-ingress           # 外部 bot-plugin 命令入口
│   ├── bot-plugin            # bot instance / credential / endpoint 管理
│   ├── integration           # provider connection / proxy / provider handler
│   ├── notify                # subscription / notification / delivery endpoint
│   └── task                  # task definition / task run / task handler
└── steam                     # Steam provider 的平台适配与业务核心
```

### Domain 与 Repository

`src/api/domain` 放通用领域基础设施：

- `infra/service-context.ts`：请求、事件和任务执行的统一上下文，携带 trace、auth、env、db、queue、kv、logger 和 repositories。
- `infra/eventing/*`：事件 envelope、outbox、inbox、dispatcher、event router。
- `infra/repository/*`：通用基础 repository port。
- `platform/repository/ports/*`：平台层 repository port，例如 connection、integration、notify、subscription。

Repository 实现按数据库类型拆分：

- `repository/pg.ts`
- `repository/sqlite.ts`
- `repository/index.ts`
- `repository/repository.ts`

业务代码依赖 port，不直接散落数据库访问逻辑。`ServiceContext.createRepository` 根据当前 `dbType` 选择 pg 或 sqlite 实现。

## 事件与任务架构

Tori 使用 outbox/inbox 模式连接同步流程和异步执行。

核心链路：

1. 业务命令通过 `ctx.sendEvent()` 写入 outbox。
2. `outboxCron` 定时扫描 pending outbox event。
3. publisher 发布事件。
4. `EventRouter` 根据 event type 找到 consumer。
5. consumer 通过 inbox 记录 handler 执行状态，保证同一 handler 对同一事件有明确处理结果。

任务系统建立在这套事件机制之上：

- `scanDueTaskCron` 扫描到期 task definition。
- 系统创建 task run，并发出 `TASK_RUN_REQUESTED` 事件。
- `platformTaskConsumers` 消费事件。
- `handleTaskRun` 根据 task definition 的 `kind` 找到已注册 task handler。
- handler 执行业务逻辑并回写 task run / task definition 的完成或失败状态。

`platform/task` 只定义通用任务机制，不绑定 notify 或 Steam。Steam 当前只提供了 `family-refresh` 这类样例 task handler；以后其他 provider 或其他业务任务也应作为新的 task kind 接入，而不是挂到 notify 名下。

## 通知架构

通知模块分为三类数据：

- subscription：订阅某个 topic / target。
- notification event：一次实际通知事件。
- delivery endpoint：通知投递端点，例如 webhook 或 bot instance 关联端点。

通知内容不是服务端生成的一段固定文本，而是结构化 JSON：

```ts
type NotificationBody = {
  version: 1;
  blocks: NotificationBodyBlock[];
};
```

`NotificationBodyBlock` 支持 heading、text、stats、list、game-grid、image、audio 等块。后端负责生成可渲染结构，客户端负责根据 blocks 渲染 UI。原始业务/debug 数据应放在 payload 一类字段中，不和面向用户展示的 body 混在一起。

## 集成与 Profile

`platform/integration` 管理通用 provider connection 和 proxy instance。Provider-specific 能力通过 handler registry 挂入：

- `getConnectionAccountProfile`
- `refreshConnectionFamily`

账号 profile 是 connection 的附属信息，前端上表现为 connection detail 的一部分，而不是独立的一张业务页面。接口返回使用通用字段：

- `externalAccountId`
- `displayName`
- `avatarUrl`
- `profileUrl`
- `lastSyncedAt`

Steam adapter 内部可以把 `steamId`、`personaName` 等 provider-specific 字段映射成这些通用字段，但通用 dashboard/API surface 不应泄露 Steam 专用模型。

## Bot 架构

Tori 区分两层 Bot 相关能力：

- `bot-ingress`：外部 bot-plugin 调用 Tori 的入口，负责认证、上下文解析、命令分发和业务结果返回。
- `bot-plugin`：管理 bot instance、credential、endpoint 和 runtime metadata。

命令定义通过 registry 注册。平台适配层只提供平台相关命令与 target 定义，例如 Steam 的账号查询、家庭库刷新、订阅 target 等。

后端 handler 应返回业务结果，不负责把结果渲染成某个平台的最终消息格式。平台渲染属于 bot-plugin 或前端/客户端层。

## Steam 适配

`src/api/modules/steam` 是当前 provider 示例。它分为两层：

- `core/*`：Steam 自己的账号、家庭、目录数据模型与服务。
- `adapters/platform/*`：把 Steam 能力注册到通用平台机制中，包括 bot-ingress 命令、事件 consumer、task handler、integration provider handler。

Steam 不是平台层的默认抽象。通用平台层只认识 provider、connection、subscription、task、notification 等稳定概念；Steam 细节停留在 steam module 内。

## Dashboard 前端架构

Dashboard 使用 TanStack Router + React Query。路由位于 `src/routes`，只做薄转发：

```tsx
export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
});
```

实际业务放在 feature：

- `features/overview`：首页概览。
- `features/binding`：用户绑定、频道绑定、claim session。
- `features/integration`：connection 和 proxy registry。
- `features/notify`：subscription 和 delivery history。
- `features/tasks`：通用任务列表。
- `features/bot-instances`：bot runtime 管理，包括实例绑定的 delivery endpoint。
- `features/playground`：Bot command playground。

每个 feature 自己维护：

- `api.ts`：请求 client、zod schema、输入输出类型。
- `query.ts`：React Query key 和 hook。
- `page.tsx`：页面组合。
- `columns.tsx` / dialogs / forms：该 feature 的 UI 细节。

这保证了前端业务边界和后端 module 边界基本一致，避免集中式 `dashboard-api` / `dashboard-queries` 变成全局垃圾桶。

## 运行时适配

`apps/tori` 支持多运行时：

- Node
- Bun
- Deno
- Cloudflare Worker
- Nitro

运行时差异被隔离在：

- `entry/*`
- `adapter/node/*`
- `adapter/cloudflare/*`

业务 module 不应该直接依赖某个具体运行时。运行时负责注入 adapter、DB、queue、cron 等基础能力，业务代码通过 `ServiceContext` 使用统一接口。

## 扩展新 Provider

接入一个新的 provider 时，优先遵循以下边界：

1. 在 `platform/integration` 创建或复用 connection/proxy 管理流程。
2. 在 provider 自己的 module 下维护 provider-specific schema、repository、service。
3. 通过 `registerIntegrationProviderHandlers` 暴露通用 provider handler。
4. 如果需要 bot 命令，通过 `registerBotCommandDefinitions` 注册。
5. 如果需要订阅 target，通过 `registerSubscriptionTargets` 注册。
6. 如果需要后台任务，通过 `defineTaskHandler` 注册新的 task kind。
7. 如果需要消费事件，通过 `eventRouter.registerConsumer` 或 module 提供的 consumer list 注册。

不要把 provider-specific 字段提升到通用 API，除非它已经被抽象成稳定的跨 provider 概念。

## 验证

常用验证命令：

```sh
vp check apps/tori/src
vp test apps/tori
```

全仓库验证：

```sh
vp check
vp test
```

本项目使用 Vite+，不要直接调用 pnpm/npm/yarn，也不要直接安装 Vitest、Oxlint、Oxfmt 或 tsdown。
