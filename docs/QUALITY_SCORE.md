# QUALITY_SCORE

本文档定义 Tori 文档、设计和实现的质量评分方式。每次较大改动可以按本标准给出 0-100 分。

## 总分构成

| 维度         | 分值 |
| ------------ | ---: |
| 架构边界     |   15 |
| 领域建模     |   15 |
| API 设计     |   10 |
| DB 设计      |   10 |
| 前端产品体验 |   10 |
| 协议完整性   |   10 |
| 安全与权限   |   10 |
| 可测试性     |   10 |
| 文档质量     |   10 |

## 架构边界 15

评分项：

- 组件职责清晰。
- 模块 owner 清晰。
- 依赖方向可从代码验证。
- 跨组件协议集中在 `protocol/`。
- 基础设施资源和业务资产生命周期分离。

## 领域建模 15

评分项：

- 资源 owner 明确。
- 状态字段与删除字段分工明确。
- `deletedAt` 负责可见性删除。
- `status` 负责业务或运行时状态。
- subscription、channel、connection、binding、bot instance 的关系可解释。

## API 设计 10

评分项：

- API 属于明确 domain。
- 通用 API 不混入 provider-specific 能力。
- provider-specific 能力通过 capability/adapter 暴露。
- 资源命令由 owner module 定义，不依赖跨资源通用命令协议。
- DTO 字段服务于页面和协议。

## DB 设计 10

评分项：

- 表归属清晰。
- 索引支持主要查询。
- 删除过滤条件明确。
- 历史数据保留策略明确。
- 业务约束由 schema、repository 和 service 共同表达。

## 前端产品体验 10

评分项：

- 用户入口完整。
- 普通用户和 admin 操作边界清晰。
- 表格展示可读名称和关键 endpoint。
- 表单字段按场景展示。
- 错误、空状态、挂起状态、删除状态有明确 UI 表达。

## 协议完整性 10

评分项：

- 参与方明确。
- request/response shape 明确。
- state machine 明确。
- retry/idempotency 明确。
- error semantics 明确。
- browser popup 或外部 callback 行为明确。

## 安全与权限 10

评分项：

- 信任边界明确。
- 认证方式明确。
- 授权判断可追踪到 owner/admin/resource。
- token、secret、credential ref 的存放边界明确。
- 公共资源和用户资源操作权限明确。

## 可测试性 10

评分项：

- 核心流程有单元或集成测试。
- repository 行为可测。
- 资源 owner module 的命令和权限校验可测。
- provider adapter 可 mock。
- 前端关键表单和状态可测。

## 文档质量 10

评分项：

- 文档职责单一。
- 文档按 domain/feature 可导航。
- requirement、design、constraint、exec-plan、安全、质量分离。
- 文档基于当前代码或明确目标。
- 文档包含验证清单。

## 评分输出格式

```txt
QUALITY_SCORE: 82/100

架构边界: 13/15
领域建模: 12/15
API 设计: 8/10
DB 设计: 8/10
前端产品体验: 7/10
协议完整性: 8/10
安全与权限: 9/10
可测试性: 7/10
文档质量: 10/10

主要扣分:
- ...

下一步:
- ...
```
