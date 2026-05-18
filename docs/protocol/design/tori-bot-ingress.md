# Tori Bot Ingress 目标协议

本文档定义 Bot runtime 向 Tori 提交外部平台命令上下文的目标协议。

## 目标

Bot Ingress 的目标是让不同外部平台的 Bot runtime 用同一套业务协议调用 Tori，同时把平台差异限制在 Bot runtime 内。

Tori 负责：

- 验证可信 Bot runtime 身份。
- 将外部平台 user/channel 映射到 Tori identity 和 channel。
- 分发到 Tori owner module command。
- 返回 command result envelope。

Bot runtime 负责：

- 接收外部平台消息。
- 解析平台消息为 command request。
- 调用 Tori Bot Ingress。
- 将 Tori 返回的 command result 渲染成平台消息。

## 参与方

- Bot runtime：外部平台 runtime。
- Tori Bot Ingress：Tori 的 command ingress。
- Tori command registry：选择 command handler。
- Tori owner module：执行具体业务命令或查询。

## 信任边界

Bot runtime 必须使用 Tori 颁发的 bot instance credential 调用 ingress。

Tori 必须校验：

- credential 有效。
- bot instance 处于可用状态。
- request 中的 platform 与 bot instance platform 一致。
- request 中的 namespace 与 bot instance namespace 一致。

Bot runtime 不能代表用户直接修改 Tori 资源。它只能提交观察到的外部平台上下文，具体资源命令由 Tori owner module 决定。

## 请求

```ts
type BotIngressCommandRequest = {
  requestId: string;
  command: {
    name: string;
    args: string[];
  };
  message: {
    platform: string;
    namespace: string;
    user: {
      externalId: string;
      displayName: string | null;
    };
    channel: {
      externalId: string;
      displayName: string | null;
      type: "dm" | "group" | "channel";
    };
    raw?: unknown;
  };
};
```

`requestId` 由 Bot runtime 生成，用于幂等、追踪和日志关联。同一个 Bot runtime 对同一条外部平台消息必须复用同一个 `requestId`。

## 响应

```ts
type BotIngressCommandResponse<TResult = BotCommandResultPayload> = {
  requestId: string;
  result: TResult;
  context: BotIngressContext;
};
```

```ts
type BotIngressContext = {
  userId: string | null;
  channelId: string;
  userBindingId: string | null;
  channelBindingId: string | null;
};
```

`result.type` 是稳定业务判别字段。Bot runtime 只能根据 `result.type` 和对应 payload 渲染平台消息，不能依赖 Tori 内部资源状态字段推断业务语义。

## 结果模型

```ts
type BotCommandResultPayload =
  | { type: "help"; commands: BotCommandSummary[] }
  | { type: "command-result"; commandName: string; payload: Record<string, unknown> }
  | { type: "command-rejected"; reason: CommandRejectReason }
  | { type: "unsupported-command"; commandName: string; supportedCommands: BotCommandSummary[] };
```

Core ingress 只保留 envelope 和基础结果形状。`command-result.payload` 的 schema 由对应 Tori owner module 或 provider adapter 定义，不由 protocol 枚举所有业务结果。

## 身份解析

每个 command request 都需要解析：

- 外部平台 user -> Tori user binding，如果存在。
- 外部平台 channel -> Tori channel binding，如果存在。
- bot instance -> trusted runtime context。

如果 user binding 缺失，Tori 可以为 claim/bind workflow 创建或复用匿名身份上下文。

需要 authenticated Tori user 的命令必须返回 `command-rejected`，不能静默创建具备权限的业务状态。

## 命令注册边界

Core ingress 只定义 command transport 和 result envelope，不拥有所有 command。

命令归属：

- Binding 命令属于 Tori binding module。
- Connection 命令属于 Tori integration module。
- Subscription 命令属于 Tori subscription module。
- Provider 专属 command 属于 provider adapter module。

Command registry 必须暴露用户可见 command summary，让 Bot runtime 可以渲染 help，而不是硬编码所有命令。

## 幂等

Tori 应将 `botInstanceId + requestId` 视为 mutating command 的幂等 key。

期望行为：

- 相同 request id 和相同 body 返回原始结果。
- 相同 request id 但 body 冲突时拒绝。
- 只读 command 可以不持久化幂等记录，但必须可安全重试。

## 错误语义

传输错误只用于：

- 认证失败。
- request 格式错误。
- 服务级故障。

业务错误必须通过 `BotCommandResultPayload` 返回，例如：

- binding 缺失。
- command 不支持。
- command 参数无效。
- provider target 不可用。
- 缺少必要 connection。
- 权限不足。

Bot runtime 应能在不解析 HTTP error body 的情况下渲染所有业务错误。

## 非目标

Bot Ingress 不负责：

- 定义 provider credential storage。
- 定义 notification delivery。
- 让 Bot runtime 拥有 Tori 资源。
- 定义全局资源生命周期命令。
