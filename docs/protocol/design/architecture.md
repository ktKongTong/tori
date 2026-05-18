# 协议架构目标设计

本文档描述目标状态下 Tori、Tori Proxy、Bot、Browser 和外部平台 runtime 之间的协议族、数据权威、通信方向和责任边界。

本文件只描述高层协议架构。具体消息形状、错误码、幂等规则和安全细节写入各协议正文。

## 协议范围

协议设计只描述跨组件边界：

- Tori 与 Tori Proxy。
- Tori 与 Bot runtime。
- Browser popup 参与的外部连接。
- Bot runtime 对外部平台 API 的适配责任边界。

Tori 内部 owner module 之间的事件和资源命令不属于协议设计。

## 协议清单

| 协议                     | 参与方                                                  | 目的                                                                                    | 文档                                                       |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Tori Token Proxy Connect | Tori Web、Tori API、Tori Proxy、Browser popup、Provider | 通过 Tori Proxy 完成 provider 授权，并让 Tori 写入 connection 与 credential reference。 | [tori-token-proxy-connect.md](tori-token-proxy-connect.md) |
| Tori Bot Ingress         | Bot runtime、Tori API、Tori command handler             | Bot runtime 将外部平台命令上下文提交给 Tori，Tori 返回结构化业务结果。                  | [tori-bot-ingress.md](tori-bot-ingress.md)                 |
| Bot Delivery             | Tori notification routing、Bot runtime、外部平台 API    | Tori 将业务事件数据和投递目标交给 Bot runtime，由 Bot runtime 渲染并投递到外部平台。    | [bot-delivery.md](bot-delivery.md)                         |

## 数据权威

协议只传递跨边界所需的数据，不转移资源 ownership。

| 数据                      | 权威方                                    | 规则                                                                         |
| ------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Tori 业务资源             | Tori owner module                         | connection、subscription、channel、task 等资源命令由对应 owner module 定义。 |
| Provider credential       | Tori Proxy                                | Tori 只保存 credential reference，不保存 provider token 明文。               |
| Provider account identity | Provider 经由 Tori Proxy exchange         | Tori 不信任 browser 传入的 provider account identity。                       |
| Bot runtime identity      | Tori bot registry                         | Bot runtime 必须使用 Tori 颁发的可信 credential。                            |
| 平台渲染                  | Bot runtime                               | Tori 传递业务事件数据，Bot runtime 负责平台渲染。                            |
| 投递结果                  | Bot runtime acknowledgement，由 Tori 记录 | Bot runtime 声明平台投递结果，Tori 记录标准化投递结果。                      |

## 权属规则

协议定义组件之间如何通信，不拥有业务资源生命周期命令。

- Tori resource command 属于 Tori owner module。
- Provider credential 属于 Tori Proxy。
- 平台渲染和平台投递属于 Bot runtime。
- 跨组件消息形状属于协议设计。

协议可以要求消息包含身份、意图、结果、确认和关联信息，但不能要求所有资源支持同一组命令。

## 流程：Tori Token Proxy Connect

```txt
Tori Web
  -> Tori API: 创建 connect session
Tori API
  -> Browser popup: 返回 connect URL
Browser popup
  -> Tori Proxy: provider auth 和账号确认
Tori Proxy
  -> Provider: authenticate
Provider
  -> Tori Proxy: auth completed
Tori Proxy
  -> Tori API callback: state + code
Tori API
  -> Tori Proxy: 服务端到服务端交换 code
Tori API
  -> Tori connection owner module: 写入 connection + credential reference
Tori callback page
  -> Tori Web: 通知 opener
```

边界：

- Browser 承载弹窗流程，但 provider account identity 不能由 Browser 声明。
- Tori Proxy 拥有 provider credential 创建。
- Tori connection module 拥有 Tori connection 写入语义。

## 流程：Tori Bot Ingress

```txt
External platform
  -> Bot runtime: platform update
Bot runtime
  -> Tori Bot Ingress: command request envelope
Tori Bot Ingress
  -> Tori command registry: 选择 command handler
Tori command handler
  -> Tori owner module: business command/query
Tori Bot Ingress
  -> Bot runtime: command result envelope
Bot runtime
  -> External platform: platform-specific rendering
```

边界：

- Bot runtime 提交观察到的外部平台上下文，不拥有 Tori 资源。
- Tori command registry 选择 command handler。
- Tori owner module 定义资源命令语义。
- Bot runtime 负责平台渲染。

## 流程：Bot Delivery

```txt
Tori owner module
  -> Tori notification producer: 创建 notification intent
Tori notification routing
  -> Tori resources: 解析 channel binding、bot instance、delivery endpoint
Tori notification producer
  -> Bot runtime delivery endpoint: business event data + delivery target
Bot runtime
  -> 外部平台 API: 平台投递
Bot runtime
  -> Tori: delivery acknowledgement response
Tori
  -> notification event: 记录 normalized result
```

边界：

- Tori 从自己拥有的资源关系中解析投递目标。
- Tori 发送业务事件数据，不发送消息排版。
- Bot runtime 拥有平台 API 调用和平台渲染。
- Tori 记录标准化投递结果，不把平台 raw response 当作业务状态。

## 协议之间的关系

协议本身相互独立，但产品工作流会组合它们。

### Connect 产生可用 connection

```txt
Token Proxy Connect
  -> Tori connection
  -> Bot Ingress command 可以使用 connection
  -> Subscription 可以使用 connection
```

Connect 协议只负责产生 Tori connection 和 credential reference，不定义 bot command 行为，也不定义 subscription 生命周期。

### Bot command 可以触发 Tori command

```txt
Bot Ingress
  -> Tori owner module command
```

Bot Ingress 只承载 command request 和 command result。资源归属仍在 Tori owner module。

### Subscription 可以产生 delivery

```txt
Subscription / task
  -> notification event
  -> Bot Delivery
  -> 外部平台消息
```

Bot Delivery 只处理投递请求、投递结果响应和幂等，不拥有 subscription target 语义。

## 兼容性原则

目标协议应明确：

- 稳定参与方。
- 信任边界。
- 数据权威。
- 消息身份和关联信息。
- 幂等 key。
- 成功和失败响应形状。
- retry 行为。
- 版本和向后兼容。
- 非目标。
