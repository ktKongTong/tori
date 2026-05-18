# Bot Delivery 目标协议

本文档定义 Tori 向 Bot runtime 投递业务事件的目标协议。

Bot Delivery 只回答两个问题：

- Tori 要把哪一个业务事件交给 Bot runtime。
- Bot runtime 应该把这个事件投递到哪个外部平台目标。

Bot Delivery 不定义消息如何排版，不定义通用消息块，也不定义平台渲染结果。渲染属于 Bot plugin 和具体平台 runtime。

## 目标

Tori 侧只传递业务事实和投递目标：

- 发生了什么事件。
- 事件来自哪个 provider/resource。
- 事件涉及哪个业务对象。
- 事件的结构化数据是什么。
- 应该投递到哪个外部平台 channel。

Bot runtime 侧负责：

- 验证投递请求来自可信 Tori。
- 根据 `event.type + schemaVersion` 找到 renderer。
- 根据事件数据和平台能力生成消息。
- 调用外部平台 API。
- 返回结构化投递结果。

## 参与方

- Tori notification producer：生成业务事件投递请求。
- Bot runtime delivery endpoint：接收 Tori 投递请求并执行平台投递。
- 外部平台 API：Telegram、Discord 等外部平台 API。

## 信任边界

Tori 到 Bot runtime 的投递必须使用 endpoint secret、签名或等价认证机制。

Bot runtime 必须校验：

- delivery endpoint 身份。
- request secret 或 signature。
- request 时间新鲜度。
- `deliveryId`。

HTTP 成功不等于外部平台投递成功。Bot runtime 必须在 response 中明确表达平台投递是否成功，以及失败是否可重试。

### 签名 Envelope

推荐使用以下 HTTP header：

- `X-Tori-Delivery-Id`：等于 request body 中的 `deliveryId`。
- `X-Tori-Delivery-Timestamp`：Unix seconds。
- `X-Tori-Delivery-Signature`：对签名输入生成的 HMAC。
- `X-Tori-Delivery-Secret-Id`：可选，用于 secret rotation。

签名输入：

```txt
deliveryId + "." + timestamp + "." + rawBody
```

Bot runtime 必须校验：

- header 中的 delivery id 与 body 中的 `deliveryId` 一致。
- timestamp 在允许窗口内。
- signature 与 endpoint secret 匹配。
- 已成功处理的 `deliveryId` 不重复投递。

Secret rotation 期间，Bot runtime 可以同时接受 active secret 和 previous secret，但必须能通过 secret id 或 endpoint 配置确定可用 secret 集合。

## 请求

```ts
type BotDeliveryRequest<TData = Record<string, unknown>> = {
  deliveryId: string;
  event: DeliveryEvent<TData>;
  target: DeliveryTarget;
  issuedAt: string;
};
```

`deliveryId` 是 Tori 生成的幂等 key。同一个业务事件投递到同一个目标时，重试必须复用同一个 `deliveryId`。

## 投递目标

```ts
type DeliveryTarget = {
  platform: string;
  namespace: string;
  externalChannelId: string;
  externalChannelName: string | null;
};
```

Tori 负责从自己的资源关系中解析投递目标，例如 subscription、channel、channel binding、bot instance 和 delivery endpoint。

Bot runtime 只负责判断这个 target 是否能在对应平台投递。Bot runtime 不选择 subscription target，也不拥有 Tori channel binding 生命周期。

## 业务事件

```ts
type DeliveryEvent<TData = Record<string, unknown>> = {
  id: string;
  type: string;
  schemaVersion: number;
  occurredAt: string;
  source: EventSource;
  subject: EventSubject;
  data: TData;
  context: DeliveryContext;
};
```

```ts
type EventSource = {
  provider: string;
  resourceType: string;
  resourceId: string | null;
};
```

```ts
type EventSubject = {
  id: string;
  type: string;
  label: string | null;
};
```

`event.type` 表示业务事件类型。`schemaVersion` 表示该事件数据 schema 的版本。

Bot runtime 必须通过 `event.type + schemaVersion` 选择 renderer。Tori 不在 Bot Delivery 协议中定义 renderer。

## 事件数据

`data` 是业务事件数据。它的 schema 由 `event.type` 的 owner 定义。

协议层只要求：

- `data` 可序列化。
- `data` 与 `schemaVersion` 对应。
- `data` 表达业务事实，不表达排版结构。
- renderer 可以只凭 `event.type + schemaVersion + data + target` 完成渲染决策。

图片、音频、链接、封面、头像等都可以是事件数据的一部分。它们不是“展示块”，而是业务对象的属性或素材引用。

示例：

```ts
type SteamFamilyLibraryUpdatedDataV1 = {
  family: {
    steamId: string;
    displayName: string | null;
  };
  changes: Array<{
    appId: string;
    name: string;
    coverImageUrl: string | null;
    storeUrl: string | null;
    changeType: "added" | "removed" | "updated";
  }>;
  totalCount: number;
};
```

这里的 `coverImageUrl` 是游戏封面数据。Telegram renderer 可以把它渲染成图片，纯文本平台 renderer 可以把它渲染成链接，不支持图片的平台 renderer 可以忽略它。

## 投递上下文

```ts
type DeliveryContext = {
  subscriptionId: string | null;
  channelId: string;
  channelBindingId: string | null;
  botInstanceId: string | null;
  deliveryEndpointId: string;
  connectionId: string | null;
};
```

`context` 用于追踪、诊断和 Dashboard 展示，不是用户消息正文。

Bot runtime 不应把这些内部 id 直接渲染给最终用户，除非平台 renderer 明确处于诊断模式。

## 渲染责任

渲染链路分三层：

| 层级             | 责任                                      |
| ---------------- | ----------------------------------------- |
| Provider adapter | 定义事件类型和 `data` schema。            |
| Bot plugin       | 为事件类型提供业务 renderer。             |
| Platform runtime | 把 renderer 输出适配成外部平台 API 调用。 |

Bot Delivery 协议不定义统一渲染 schema。不同平台可以用不同形式呈现同一个事件。

## 响应

```ts
type BotDeliveryResponse =
  | {
      ok: true;
      deliveryId: string;
      platformMessageId?: string | null;
      deliveredAt: string;
    }
  | {
      ok: false;
      deliveryId: string;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    };
```

Bot runtime 能识别平台错误时，必须返回结构化错误。Tori 记录结构化错误，不解析平台 raw response 作为业务状态。

Bot Delivery 采用同步 acknowledgement：Bot runtime 完成平台投递尝试后，用 HTTP response 返回 `BotDeliveryResponse`。本协议不定义单独的异步 ack endpoint。

## 重试与幂等

Tori 可以重试：

- 网络请求失败。
- Bot runtime 返回 retryable failure。
- Bot runtime 返回 5xx。

Tori 不应重试：

- secret 或 signature 校验失败。
- target channel 明确无效。
- Bot runtime 返回 non-retryable failure。

Bot runtime 必须把重复 `deliveryId` 视为幂等请求。如果消息已经投递成功，应尽量返回原始成功结果。

## 记录结果

Tori 必须保存 normalized delivery result：

- event id。
- event type。
- delivery id。
- target summary。
- delivery endpoint id。
- sent/failed status。
- platform message id，如果存在。
- error code 和 message，如果失败。
- 时间戳。

Dashboard 使用 normalized delivery result 解释失败，不依赖外部平台 raw response。

## 非目标

Bot Delivery 不负责：

- 定义 Bot ingress command。
- 定义 provider subscription 语义。
- 让 Bot runtime 修改 Tori 资源。
- 定义统一消息排版 schema。
- 要求不同平台以相同视觉形式渲染同一个事件。
