# Tori Design

记录 Tori 的产品设计、架构设计、领域模型、API 设计和已接受的目标实现方式。

## 文档索引

- [architecture.md](architecture.md)：Tori 控制平面的运行时、模块形态、存储和外部连接。
- [binding.md](binding.md)：User binding、channel、channel binding 和 binding grant。
- [connection.md](connection.md)：Connection、proxy instance、credential reference 和 token-proxy connection session。
- [runtime-registry.md](runtime-registry.md)：Bot plugin instance 和 delivery endpoint。
- [subscription.md](subscription.md)：Subscription、notification event 和派生 task definition。
- [task.md](task.md)：Task definition、task run、cron scanner、task registry 和 task command。
- [dashboard-api.md](dashboard-api.md)：Dashboard API ownership、DTO 和权限边界。

## 写作范围

Tori design 写 Tori 控制平面内部设计：

- 状态机。
- 命令。
- 查询。
- API shape。
- 事件。
- 错误语义。

跨 Tori、Tori Proxy、Bot 的交互写入 [../../protocol/](../../protocol/README.md)。
资源生命周期命令属于具体资源 owner module，不写成跨 domain protocol。
资源归属和权限根写入 [../constraint/resource-ownership.md](../constraint/resource-ownership.md)。
