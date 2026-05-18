# Tori 架构设计

本文档从 high level 描述 Tori 控制平面如何运作：运行时入口、模块组织、同步请求路径、异步事件路径、任务执行路径，以及它和 Tori Proxy、Bot、Browser 的边界。

具体资源、命令和状态细节见各模块 design 文档。

## 运行时角色

Tori 是系统的控制平面。

它负责：

- 提供 Dashboard 和 HTTP API。
- 维护 Tori 业务资源和资源关系。
- 记录 provider connection、bot instance、subscription、notification event、task 等控制面数据。
- 通过 Tori Proxy 使用 provider data-plane，但不保存 provider token 明文。
- 通过 Bot runtime 接收外部平台命令和投递通知，但不把 Tori 业务资源 ownership 交给 Bot。
- 通过 outbox/inbox 和 task runner 处理异步资源影响。

Tori 不是 provider credential store，也不是 Bot runtime。Tori 只保存 credential reference、runtime registry 和业务配置。

## 入口

### Bot Runtime

Bot runtime 通过 bot-ingress 调用 Tori：

```txt
External platform
  -> Bot runtime
  -> Tori /api/bot-ingress/*
  -> Tori command/query
  -> Bot response
```

Bot runtime 只能通过协议入口影响 Tori，不能直接拥有 connection、subscription、task 等 Tori 资源。

### Tori Proxy

Tori 通过 token-proxy external connect 和 provider data-plane 使用 Tori Proxy：

```txt
Tori Dashboard
  -> Browser popup
  -> Tori Proxy external connect
  -> Tori callback
  -> Tori connection / credential reference
```

Tori Proxy 拥有 provider credential 和 provider data-plane。Tori 只保存 proxy instance、connection 和 credential reference。

### Internal Workers

Tori 内部 worker 处理：

- outbox event dispatch。
- inbox 幂等消费记录。
- due task scan。
- task run execution。

## 服务组合

主要 platform route：

| Route group           | Module                                 |
| --------------------- | -------------------------------------- |
| `/api/binding/*`      | binding                                |
| `/api/integration/*`  | connection and proxy instance registry |
| `/api/notification/*` | subscription and notification          |
| `/api/tasks/*`        | task                                   |
| `/api/bot-plugin/*`   | bot runtime registry                   |
| `/api/bot-ingress/*`  | bot ingress command gateway            |

每个 route group 进入对应 owner module。跨模块资源影响不通过“通用资源操作协议”完成，而是通过 owner module command、query 和 lifecycle event 完成。

## 模块形态

Tori platform module 通常按以下方式组织：

```txt
route
  -> command / query / mapper
  -> repository interface
  -> pg/sqlite repository implementation
  -> db schema
```

职责边界：

- `route`：HTTP shape、auth middleware、OpenAPI 描述、request/response DTO。
- `command`：业务命令、权限前置条件、资源状态更新、发送 outbox event。
- `mapper`：将 repository row 转成 Dashboard/API DTO。
- `repository`：封装 DB 查询和写入，表达 owner/visibility 过滤。
- `event`：定义 lifecycle event 和 consumer。

模块 owner 负责解释自己资源的命令语义。其他模块不能直接定义该资源是否支持删除、禁用或恢复；credential、secret、grant 这类授权材料的撤销语义也只能由拥有它的模块定义。

## Service Context

`ServiceContext` 是同步请求和异步 consumer 的共享运行上下文。

它携带：

- current user、user id、role。
- env、kv、auth、queue。
- trace、correlation、causation 信息。
- logger。
- repository container。
- outbox event 写入能力。

同步 API 和异步 event handler 都通过 `ServiceContext` 访问 repository。这样 request path 和 worker path 使用同一套权限、数据访问和事件写入模型。

## Repository Container

Tori 使用 repository container 聚合各模块 repository：

```txt
ServiceContext.repositories
  ├── binding
  ├── integration
  ├── connection
  ├── notify
  ├── subscription
  ├── task
  ├── outbox
  └── inbox
```

Repository 是模块访问 DB 的边界。Dashboard/API 不应依赖前端过滤补权限；owner/admin/resource visibility 必须在 command/query/repository 层表达。

## 同步请求路径

同步 API 的典型路径：

```txt
HTTP request
  -> auth/session middleware
  -> route validation
  -> ServiceContext
  -> owner module command/query
  -> repository
  -> response DTO
```

命令如果改变资源状态，并且需要影响其他 owner module，应写入 lifecycle event。同步 API 不应该在一个请求里深度模拟所有下游副作用。

## 异步事件路径

Tori 使用 outbox/inbox 处理模块间异步影响：

```txt
owner command
  -> update owner resource
  -> write outbox event
  -> event router dispatch
  -> consumer in affected owner module
  -> write inbox processing result
```

事件只描述已经发生的事实，例如 connection disabled、bot instance deleted、subscription disabled。

事件 consumer 处理自己拥有的资源：

- connection lifecycle 可以影响 subscription。
- proxy instance lifecycle 可以影响 connection。
- bot instance lifecycle 可以影响 channel binding。
- subscription lifecycle 可以影响派生 task definition。
- task run requested 可以触发 task runner。

事件 consumer 不能反向定义上游资源支持哪些命令。

## Task 路径

Task path 有两个入口：

```txt
manual run API
  -> create TaskRunRequested event
  -> task event consumer
  -> task registry handler
```

```txt
cron scanner
  -> scan enabled task definition
  -> create task run
  -> create TaskRunRequested event
  -> task event consumer
  -> task registry handler
```

通用 task runner 只负责 task definition enabled、handler existence、run status 和结果落库。Provider-specific handler 必须自行校验它执行所需的 connection、subscription、credential 状态。

## Domain 边界

### Tori Owns

- Tori user/profile context used by the control plane。
- user binding、channel、channel binding。
- connection records and credential references。
- proxy instance registry。
- bot instance registry and delivery endpoint registry。
- subscription。
- notification event。
- task definition and task run。
- outbox/inbox。

### Tori Proxy Owns

- provider credential 明文。
- provider auth session。
- provider token refresh。
- provider data-plane request execution。

### Bot Owns

- external platform update receiving。
- platform-specific command parsing/rendering。
- platform delivery API calls。
- trusted bot runtime process。

### Protocol Owns

- Tori <-> Tori Proxy external connect。
- Bot -> Tori bot-ingress。
- Tori -> Bot delivery。

## 设计索引

- [binding.md](binding.md)：Identity and binding module。
- [connection.md](connection.md)：Connection and proxy registry module。
- [runtime-registry.md](runtime-registry.md)：Bot runtime registry module。
- [subscription.md](subscription.md)：Subscription and notification module。
- [task.md](task.md)：Task module。
- [dashboard-api.md](dashboard-api.md)：Dashboard API DTO and permission boundary。
