# Dashboard Product Spec

Dashboard 是 Tori 控制平面的操作界面。它必须让用户按工作流完成设置、检查状态和恢复失败，而不是只浏览数据库表。

## Navigation

Dashboard 导航覆盖：

- Home
- Connections
- Proxy Registry
- User Bindings
- Channel Bindings
- Subscriptions
- Notification Events
- Tasks
- Bot Runtime
- Playground

普通用户可以看到公共 token-proxy instance 和全部 bot instance 的只读信息。Bot instance 管理入口只对 admin 可用。

## Workflow Acceptance

### First Setup

前置条件：

- 用户已登录。
- 用户没有完整可用的 binding、connection 或 subscription。

用户需要看到：

- 当前还缺哪一步。
- 每一步缺失的影响。
- 下一步主操作入口。
- 已完成步骤的可用状态。

验收标准：

- 用户不需要遍历侧边栏猜设置顺序。
- 缺少 channel binding、connection 或 subscription 时，Home 或相关页面能给出可执行入口。
- 已经完成的步骤不再作为阻断项展示。

### Connection Management

前置条件：

- 用户进入 connection list 或 detail。

用户需要完成：

- 创建 public-id connection。
- 通过 token-proxy external connect 创建 proxy-backed connection。
- 查看 provider account 和 proxy 摘要。
- 禁用或删除 connection 前看到真实影响。

验收标准：

- 列表首列能识别 provider account，而不是内部 id。
- disabled/deleted connection 的影响能解释到 subscription 和 task。
- 高风险命令使用 connection module 提供的影响说明，不使用 `window.confirm`。

### Subscription Creation

前置条件：

- 用户有 active connection。
- 用户有 active channel binding。

用户需要完成：

- 选择可用 connection。
- 选择可投递 channel。
- 选择 topic/event target。
- 创建后看到 subscription 是否已生成派生 task。

验收标准：

- 缺少 connection 或 channel binding 时，表单提交前已经说明原因和恢复入口。
- subscription target 使用用户可理解的名称，不要求用户理解内部 `topicKey`。
- provider-specific target 只在 matching provider 下出现。

### Task And Delivery Diagnosis

前置条件：

- 用户或 admin 查看 task、task run、notification event。

用户需要看到：

- task 是否 enabled。
- 最近一次 run 的结果。
- failed run 的原因摘要。
- notification delivery 是否 sent/failed。
- failed delivery 的 bot endpoint、channel binding 和错误摘要。

验收标准：

- `Never run`、`No delivery yet`、failed、disabled 这类状态有不同文案。
- 诊断页可以展示内部 id，但普通列表不把内部 id 作为主要信息。

### Admin Runtime Health

前置条件：

- 当前用户是 admin。

Admin 需要看到：

- unhealthy proxy。
- inactive/disabled bot instance。
- failed task run。
- failed notification delivery。
- suspended channel binding。

验收标准：

- Admin health summary 能定位到受影响资源。
- Bot/proxy 管理入口只对 admin 可操作。
- 后端 API 继续执行 admin 权限校验，前端隐藏入口不作为安全边界。

## Lists

列表首列展示用户可读对象名称。内部 id 只放在 detail 或诊断区域。

状态列展示运行状态和原因：

- active
- disabled
- suspended
- deleted

时间列展示用户可读时间，并解释空时间：

- Never synced
- Never run
- No delivery yet

## Details

详情页展示：

- resource summary
- relation summary
- 当前状态
- module command summary
- event/run/history
- diagnostic fields

Provider-specific command 只在 matching provider detail 中展示。

## Empty And Error States

空状态给出下一步入口。

权限不足状态说明当前用户不能管理该资源。公共 bot instance 对普通用户只读。

Suspended 状态说明缺失依赖，并给出恢复入口。
