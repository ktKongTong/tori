# API 模块设计

本文档描述 Tori 当前的 API 设计和代码组织方式。
目标架构是垂直切片式的模块化单体：每个能力自己拥有 contract、route、command、repository port、repository implementation、mapper 和模块本地类型。

## 模块分类

Tori 后端模块分为三类。

### Infra

Infra 模块提供技术基础能力。它们不表达产品能力或业务能力。

示例：

- `api/domain/infra/db.ts`
- `api/domain/infra/eventing`
- `api/domain/infra/eventing/repository`
- `api/domain/infra/service-context.ts`
- `api/support/repository-container.ts`

Infra 可以被 platform module 和 business module 使用。Infra 不应该导入 platform module 或 business module。
例外是 repository composition root，因为它明确是应用层装配文件。

### Platform

Platform module 提供可复用的产品平台能力。它们可以依赖 infra，也可以被上层 business module 消费。

当前 platform 能力：

- `platform/binding`：身份与渠道绑定。
- `platform/bot-plugin`：托管 bot runtime instance。
- `platform/bot-ingress`：bot command ingress 和上下文。
- `platform/connection`：provider account connection，以及 account profile / family refresh 入口。
- `platform/integration`：外部 proxy / provider registry，以及 proxy instance 管理。
- `platform/notify`：notification body、endpoint、event、delivery、stream 等通知投递基础能力。
- `platform/subscription`：topic subscription 生命周期和 subscription event history。
- `platform/task`：scheduled task definition 和 task run history。

Platform module 之间可以有依赖，但依赖必须是显式且有方向的。
例如，`subscription` 可以创建 lifecycle outbox event，也可以使用 binding/channel 概念；但 `notify` 不应该拥有 subscription persistence。

### Business Module

Business module 是顶层独立业务域。它们可以依赖 infra 和 platform，但不能互相依赖。

当前示例：

- `api/modules/steam`

Business module 应该把自己的领域 repository、adapter、schema、command logic、route definition 放在模块内部。
共享 platform 能力应该通过 platform public API 或 `ctx.repositories` 消费，而不是通过导入另一个 business module 消费。

## 标准模块形态

一个标准 platform module 或 business module 应该长这样：

```txt
api/modules/<class>/<module>/
  contract.ts
  type.ts
  command.ts
  route.ts
  mapper.ts
  repository/
    index.ts
    repository.ts
    pg.ts
    sqlite.ts
  *.test.ts
```

不是每个模块都必须有所有文件。
例如，没有外部 HTTP contract 的模块可以没有 `contract.ts`；没有持久化的模块可以没有 `repository`。

### `contract.ts`

`contract.ts` 定义 HTTP/API 边界。

它负责：

- request schema
- response schema
- DTO schema
- 由 schema 推导出来的 DTO type
- list endpoint 的分页 response schema

命名示例：

```ts
export const subscriptionDtoSchema = z.object(...);
export const subscriptionPageDtoSchema = PageBasedPaginationResultSchema(subscriptionViewDtoSchema);
export type SubscriptionDto = z.infer<typeof subscriptionDtoSchema>;
```

规则：

- 前端 API client 从 `contract.ts` 导入 schema 和 DTO type。
- 后端 route 使用同一份 schema 做 request validation 和 OpenAPI metadata。
- 不要在前端文件里重复定义 zod schema。
- 不要创建兼容用的 `schema.ts` re-export 文件。
- 不要把 DTO alias 成假的业务名，例如 `TaskDef = TaskDefinitionDto`。

### `type.ts`

`type.ts` 定义模块本地的业务类型。它们不是 HTTP contract，也不是 repository record。

它负责：

- 和 DTO 不一致的 command input type
- event name 和 event payload
- 模块本地 union 和 state type

示例：

```ts
export const SUBSCRIPTION_CREATED = "SubscriptionCreated";
export type SubscriptionLifecyclePayload = { ... };
```

规则：

- 前端不应该导入 `type.ts`。
- 其他模块只有在这是明确的集成面时，才可以导入 event name 或 public payload type。
- 如果某个 type 属于 HTTP 边界，它应该放在 `contract.ts`，而不是 `type.ts`。

### `command.ts`

`command.ts` 包含编排逻辑和业务 use case。

它负责：

- 需要权限语义的编排逻辑
- 通过 `ctx.repositories` 调用 repository
- 创建 outbox event
- id generation
- business error
- 在明确允许时调用其他 platform capability API

规则：

- Command 不应该导入 PG/SQLite repository implementation。
- Command 应该使用 `ServiceContext`。
- Command 应该优先通过 `ctx.repositories` 使用 repository port。
- Command 返回 business object，而不是 DTO；除非这个 command 明确就是 DTO shaping function。Route/mapper 负责 DTO shaping。

### `route.ts`

`route.ts` 定义 HTTP endpoint。

它负责：

- URL path handler
- `describeRoute` metadata
- 通过 contract schema 做 request validation
- 通过 mapper 做 response shaping

规则：

- Route 从本模块 `contract.ts` 导入 schema。
- Route 调用 command 或 repository，然后 map 成 DTO。
- Route 不应该包含 DB logic。
- Route 不应该重复内联 DTO schema，除了非常小的一次性 primitive。

### `mapper.ts`

`mapper.ts` 把内部对象转换成 API DTO。

它负责：

- BO 到 DTO 的转换
- page result mapping
- `Date` 到 ISO string 的转换
- nullable/default normalization
- route 返回 joined view 时的 aggregate view shaping

示例：

```ts
export function mapSubscriptionPage(
  page: PageBasedPaginationResult<Subscription>,
): PageBasedPaginationResult<SubscriptionViewDto> {
  return { ...page, data: page.data.map(toSubscriptionViewDto) };
}
```

规则：

- Mapper 导入 repository/domain BO 和 contract DTO。
- Mapper 是 BO 和 DTO 正常相遇的唯一位置。
- 前端永远不应该导入 mapper。

### `repository/repository.ts`

这个文件定义模块拥有的 repository port 和 BO。

它负责：

- repository interface
- repository input type
- repository output business object
- list pagination type

示例：

```ts
export interface ISubscriptionRepository {
  listSubscriptions(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<Subscription>>;
}
```

规则：

- Repository port 跟随 owning module 放置。
- 不要在 `api/domain/platform/repository/ports` 下定义 platform repository port。
- 不要把 module repository port 放进全局 `api/repository` 目录。
- Repository BO 可以使用 `Date`、`unknown` 和业务层 nullable field。
- Repository BO 不是 DTO。

### `repository/pg.ts` 和 `repository/sqlite.ts`

它们是模块 repository port 的基础设施 adapter。

它们负责：

- Drizzle table access
- SQL join
- DB-specific pagination mechanics
- DB insert/update/select 到 repository BO 的转换

规则：

- 它们可以导入 DB schema 和 DB util。
- 它们实现本模块的 `I<Module>Repository`。
- 它们不应该导入 route、frontend API 文件或 DTO schema。
- DBO/projection 细节应该留在 repository implementation 内部，除非某个 projection 本身就是 repository port 的一部分。

### `repository/index.ts`

这是模块 repository 给应用装配层使用的 public export。

通常导出：

```ts
export { SubscriptionPgRepository } from "./pg";
export { SubscriptionSqliteRepository } from "./sqlite";
export type { ISubscriptionRepository } from "./repository";
```

不要用这个文件 re-export DTO 或无关的模块内部细节。

## Composition Root

`api/support/repository-container.ts` 是唯一把具体 repository implementation 装配进 `ServiceContext` 的地方。

它可以导入：

- infra repository implementation
- platform repository implementation
- 属于 `ServiceContext` 的 business module repository implementation

它不应该拥有 repository definition。它只是 wiring file。

`api/domain/platform/repository/container.ts` 定义 repository container type：

```ts
export type PlatformRepositoryContainer = InfraRepositoryContainer & {
  binding: IBindingRepository;
  connection: IConnectionRepository;
  integration: IIntegrationRepository;
  notify: INotifyRepository;
  subscription: ISubscriptionRepository;
};
```

这个 type 是允许的，因为它表达的是 service-context shape，不是 repository ownership。

## 当前 Platform 边界

### `notify`

拥有 notification delivery primitive：

- notification body model
- delivery endpoint
- notification event
- delivery candidate creation
- delivery status update
- SSE notification stream

不拥有：

- subscription creation
- subscription list/detail
- subscription status update
- subscription event-history route

这些属于 `subscription`。

### `subscription`

拥有 subscription lifecycle：

- create subscription
- activate/disable subscription
- list subscriptions
- subscription detail view
- notification event history by subscription
- subscription lifecycle outbox event

它可以消费 notification event DTO，因为 subscription history 需要展示 notification event；但 ownership 仍然分离：

- event schema：`notify/contract.ts`
- subscription page/history schema：`subscription/contract.ts`

### `integration`

拥有 external proxy/provider integration：

- proxy instance registration
- proxy health probing
- proxy status change
- provider registry hook

不拥有：

- provider account connection
- account profile list
- family refresh HTTP endpoint

这些属于 `connection`。

### `connection`

拥有 provider account connection：

- create connection
- list connections
- list account profiles
- resolve connection access
- account profile/family refresh HTTP endpoint

它可以调用 integration provider registry 执行 provider-specific action。
依赖方向是 `connection -> integration/provider-registry`，不是 `integration repository -> connection repository`。

## 前端引用规则

前端 feature API 文件应该只导入 public API boundary contract：

```ts
import {
  connectionListDtoSchema,
  type ConnectionDto,
} from "@/api/modules/platform/connection/contract";
import {
  proxyInstanceListDtoSchema,
  type ProxyInstanceDto,
} from "@/api/modules/platform/integration/contract";
```

允许的前端 import：

- `*/contract.ts`
- UI component
- 前端本地 query/API helper

禁止的前端 import：

- `*/command.ts`
- `*/repository/*`
- `*/type.ts`，除非该 type 被明确记录为 frontend-safe public type
- mapper
- DB schema

前端 view model 应该是真实 aggregate，而不是 DTO alias。

允许：

```ts
export type IntegrationConnectionListItem = {
  connection: ConnectionDto;
  proxy: ProxyInstanceDto | null;
  profile: AccountProfileDto | null;
};
```

禁止：

```ts
export type BotInstance = BotInstanceDto;
export type TaskDef = TaskDefinitionDto;
export type ClaimSessionRow = ClaimSessionDto;
```

## 后端引用规则

Route：

- 导入 contract schema
- 调用 command 或 `ctx.repositories`
- 调用 mapper 生成 response DTO

Command：

- 导入本地 `type.ts`
- 使用 `ctx.repositories`
- 可以导入 event helper 和 infra helper
- 不导入 repository implementation

Repository：

- 导入本地 repository port
- 导入 DB schema
- 导入 DB util
- 不导入 frontend 或 route code
- 通常不导入 contract schema

Business module：

- 当 platform module 是预期依赖时，可以导入 platform command/type/route/contract
- 不应该导入另一个 business module

## 概念变体

同一个产品概念可以有几种合法的类型变体。变体必须按边界显式命名。

### DTO

DTO 是 API wire type。它们放在 `contract.ts`。

特征：

- 可序列化
- date 是 string
- 由 zod 校验
- 前端可安全使用

示例：

```ts
SubscriptionDto;
ConnectionDto;
ProxyInstanceDto;
```

### BO

Business object 是模块内部或 repository output type。它们放在 `repository/repository.ts`，少数情况下放在 `type.ts`。

特征：

- 可以包含 `Date`
- 可以包含内部 nullable field
- read view 可以包含 joined object
- 不直接暴露给前端

示例：

```ts
Subscription;
Connection;
NotificationEvent;
```

### DBO / DB Projection

DBO 是数据库行或选出来的 projection。

特征：

- 由 Drizzle schema inference 或 repository-local select shape 创建
- 应该留在 `repository/pg.ts` 或 `repository/sqlite.ts` 内部
- 不应该泄漏到 route、command、frontend 或 contract

如果 projection 必须跨过 repository port，应该按业务含义命名，而不是按表/行机制命名。

推荐：

```ts
Subscription;
SubscriptionDetail;
NotificationDeliveryCandidate;
```

避免：

```ts
NotifyEventRow;
NotifySubscriptionView;
ClaimSessionRow;
```

### Command Input

Command input 是 use-case input。当它和 API DTO 不同时，放在 `type.ts`。

特征：

- 可以比 DTO 更窄或更丰富
- 应该反映业务 use case 的需求
- 可以由 route 从 DTO 构造出来

示例：

```ts
CreateSubscriptionInput;
RegisterProxyInstanceInput;
```

### Repository Input

Repository input 是 persistence input。它放在 `repository/repository.ts`。

特征：

- 接近 storage operation
- 如果 command 生成 id，它会包含生成后的 id
- 不一定等于 DTO 或 command input

示例：

```ts
CreateTaskDefinitionInput;
CreateConnectionInput;
CreateNotificationEventInput;
```

### View Model / List Item

前端 view model 是 UI aggregate。它们放在 feature API/query/columns 文件中。

特征：

- 组合多个 DTO
- 只因为 UI 需要 derived shape 而存在
- 不应该把 DTO 藏在另一个名字后面

示例：

```ts
IntegrationConnectionListItem = {
  connection: ConnectionDto;
  proxy: ProxyInstanceDto | null;
  profile: AccountProfileDto | null;
}
```

## Pagination

可能增长的 list endpoint 必须接受 page-based pagination。

后端：

- route 使用 `PageBasedPaginationParamSchema`
- repository port 接受 `PageBasedPaginationParam`
- repository implementation 返回 `PageBasedPaginationResult<T>`
- mapper 把 `PageBasedPaginationResult<BO>` 映射成 `PageBasedPaginationResult<DTO>`

前端：

- API client 接受 `PageBasedPaginationParam`
- query key 包含 pagination params
- table UI 可以使用 `DashboardPagination`

Task run history 不是唯一需要分页的地方。
Binding、bot instance、integration proxy instance、connection、account profile、subscription、subscription notification history 都是需要分页的列表。

## API Route Compatibility

代码 ownership 和 URL path 是两件事。

当前 route 保持已有 public path：

- `/api/integration/proxy-instances/*` 由 `platform/integration` 实现。
- `/api/integration/connections/*` 由 `platform/connection` 实现。
- `/api/notification/delivery-endpoints/*` 和 stream 由 `platform/notify` 实现。
- `/api/notification/subscription/*` 由 `platform/subscription` 实现。

这样可以在修正代码 ownership 的同时保持 client 稳定。

## 合理性评估

### 好的地方

当前方向是合理的，因为 module ownership 已经能从文件系统中直接看出来。

修改 subscription 行为时，主要文件是：

- `platform/subscription/contract.ts`
- `platform/subscription/command.ts`
- `platform/subscription/route.ts`
- `platform/subscription/mapper.ts`
- `platform/subscription/repository/*`

修改 connection 行为时，主要文件是：

- `platform/connection/contract.ts`
- `platform/connection/command.ts`
- `platform/connection/route.ts`
- `platform/connection/repository/*`

这避免了之前的分裂状态：一个能力被拆散到 shared contracts、domain ports、global repository implementation 和 module routes 里。

### 仍然存在的权衡

Route 仍然保留 legacy public path group。
例如，connection route 仍挂在 `/api/integration` 下。
这对兼容性是可以接受的，但意味着 URL grouping 和代码 ownership 并不完全一致。

一些 platform module 仍会依赖其他 platform module 的概念。
这是正常的，但依赖方向必须显式。
例如，`subscription` 可以使用 `notify` 的 notification event DTO 来输出 history。
`notify` 不应该拥有 subscription write。

Repository container 仍然是一个中心化的 repository 列表。
这是可接受的 application composition，但它必须只停留在 wiring layer。

### 需要警惕的风险

不要重新引入 `shared/contracts` 作为垃圾桶。
如果 contract 属于某个模块，就放在那个模块里。

不要把所有 repository port 再搬回全局 `domain/repository/ports` 目录。
那样看起来字母顺序更整齐，但会破坏 feature locality。

不要用前端 alias 重命名 DTO。
要么直接消费 DTO，要么定义真实 aggregate view model。

不要让 `integration` 变成所有 external-system concept 的总垃圾桶。
Proxy/provider registry 和 connection/account ownership 是不同能力。

不要让 `notify` 变成所有 message-related concept 的总垃圾桶。
Delivery 和 subscription 是不同能力。

## 新增能力的流程

新增 platform capability：

1. 创建 `api/modules/platform/<capability>`。
2. 添加 `contract.ts` 定义 HTTP schema 和 DTO。
3. 添加 `type.ts` 定义本地 business/event type。
4. 添加 `repository/repository.ts` 定义 BO、input、repository port。
5. 添加 `repository/pg.ts` 和 `repository/sqlite.ts`。
6. 添加 `command.ts` 定义 use case。
7. 如果 route response 从 BO 暴露 DTO，添加 `mapper.ts`。
8. 添加 `route.ts`。
9. 在 `api/server/routes.ts` 注册 route。
10. 在 `api/support/repository-container.ts` 装配 repository implementation。
11. 前端 feature API client 只通过 `contract.ts` 使用 API contract。

新增 business module：

1. 创建 `api/modules/<business-domain>`。
2. 把它自己的 repository、route、command、mapper、schema、adapter 留在模块内部。
3. 显式依赖 platform capability。
4. 不直接导入另一个 business module。
