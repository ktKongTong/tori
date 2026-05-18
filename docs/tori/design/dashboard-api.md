# Dashboard API Design

## API Ownership

Tori Dashboard 调用 Tori API。每个 API 属于对应资源 owner module：

| API Area                | Owner                    |
| ----------------------- | ------------------------ |
| Binding                 | Tori binding module      |
| Connection              | Tori integration module  |
| Proxy Instance Registry | Tori integration module  |
| Bot Instance Registry   | Tori bot-plugin module   |
| Subscription            | Tori notification module |
| Notification Event      | Tori notification module |
| Task                    | Tori task module         |
| Bot Ingress Debug       | Tori bot-ingress module  |

## Permission

普通用户 API 查询以当前 session user 为根：

- own resources
- created resources
- owner resources

Admin API 可以跨 owner 查询。Admin 权限由后端校验，前端导航只负责展示体验。

## DTO Shape

Dashboard DTO 使用页面需要的可读摘要，不直接暴露 raw relation id 作为主要显示字段。

列表 DTO 需要包含：

- primary label
- status
- owner summary
- related resource summary
- timestamps
- module command summary，如该资源 owner module 有需要展示的命令

Detail DTO 可以包含更完整的诊断字段。

### Module Command Summary

模块命令摘要由资源 owner module 生成，不是跨资源通用命令抽象。

```ts
type ModuleCommandSummary = {
  name: string;
  label: string;
  enabled: boolean;
  disabledReason?: string;
  impactSummary?: string;
  risk?: "normal" | "high";
};
```

Dashboard 只能展示并调用 owner module 暴露的命令。是否可用、为什么不可用、执行影响是什么，都由 owner module 决定。

### Connection DTO

Connection list/detail DTO 应展示：

- provider account label。
- provider account id。
- access mode。
- status 和状态原因。
- proxy instance summary，如果存在。
- capability summary。
- 最近同步或最近验证时间。
- connection module command summary。

Provider credential 明文、provider token、proxy API key 不进入 DTO。

### Subscription DTO

Subscription list/detail DTO 应展示：

- owner summary。
- connection summary。
- channel summary。
- target summary。
- event type summary。
- status 和状态原因。
- derived task definition summary。
- 最近 notification event summary。
- subscription module command summary。

### Task DTO

Task list/detail DTO 应展示：

- task definition label。
- task kind。
- schedule summary。
- owner/source summary。
- enabled status。
- last run summary。
- next run summary，如果可计算。
- task module command summary。

Task run history DTO 应展示 run status、summary、error code、retryable、scheduled/started/finished timestamps。

### Notification Event DTO

Notification event DTO 应展示：

- event type。
- subscription summary。
- channel binding summary。
- bot instance summary。
- delivery endpoint summary。
- sent/failed status。
- platform message id，如果存在。
- error code/message，如果失败。

普通列表不以内部 id 作为主信息；诊断详情可以展示内部 id。

## Provider Capability

Connection 通用 API 不承载 Steam family 这类平台专有语义。Provider-specific command 由 provider capability 决定，并只在匹配 provider 的 connection detail 中展示。

Capability 示例：

- `steam.account.profile`
- `steam.family.refresh`
- `steam.family.library`

## Resource Commands

Dashboard API 不定义跨资源通用命令协议。

每个资源页面只能展示该资源 owner module 暴露的命令。命令的可用性、影响说明、权限校验和执行语义都由 owner module 定义。

如果某个模块需要为高风险命令提供执行前说明，该 DTO 属于该模块自己的 API 设计，不要求其他资源实现同名 endpoint 或同一套命令枚举。
