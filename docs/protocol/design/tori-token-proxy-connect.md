# Tori Token Proxy Connect 目标协议

本文档定义 Tori、Tori Proxy 和浏览器弹窗之间的外部连接目标协议。

## 目标

外部连接的目标是让用户在 Tori Dashboard 中选择 provider 和 proxy instance，通过 Tori Proxy 完成 provider 授权，并让 Tori 只保存 connection 和 credential reference。

Tori 负责：

- 创建 Tori connect session。
- 生成 callback URL 和 state。
- 校验 callback。
- 与 Tori Proxy 交换一次性 code。
- 写入 Tori connection 和 credential reference。

Tori Proxy 负责：

- 完成 provider auth。
- 让用户确认 provider account。
- 创建 proxy-side credential。
- 生成一次性 exchange code。
- 向 Tori callback 返回 code 和 state。

Browser popup 负责：

- 承载 Tori Proxy 授权 UI。
- 回到 Tori callback。
- 通知 opener 授权结果。

## 参与方

- Tori Web。
- Tori API。
- Tori Proxy Web/API。
- Provider。
- Browser popup。

## 核心实体

### Proxy Instance 引用

```ts
type ProxyInstanceRef = {
  id: string;
  baseUrl: string;
  providerCapabilities: ProviderCapability[];
};
```

Tori 使用 proxy instance ref 启动外部连接，但不读取 provider credential 明文。

### Tori 连接会话

```ts
type ToriConnectSession = {
  id: string;
  state: string;
  ownerUserId: string;
  proxyInstanceId: string;
  provider: string;
  accessMode: "proxy-token" | "mixed";
  status: "pending" | "completed" | "failed" | "expired";
  callbackUrl: string;
  connectUrl: string;
  expiresAt: string;
};
```

`state` 必须不可预测。`sessionId + state` 共同绑定一次弹窗流程。

### Proxy 托管的 connection

```ts
type ProxyBackedConnection = {
  id: string;
  ownerUserId: string;
  provider: string;
  providerAccountId: string;
  providerAccountName: string | null;
  providerAccountAvatar: string | null;
  accessMode: "proxy-token" | "mixed";
  proxyInstanceId: string;
  credentialRef: string;
  status: "active";
};
```

Tori connection 表达“哪个 Tori user 通过哪个 proxy instance 连接了哪个 provider account”。Provider token 明文不进入 Tori。

## 总体流程

```txt
Tori Web
  -> Tori API: 创建 connect session
  <- Tori API: connectUrl + state
  -> Browser popup: open connectUrl

Browser popup
  -> Tori Proxy: provider auth 和账号确认
  -> Provider: authenticate
  <- Provider: auth completed
  -> Tori Proxy: 创建 proxy credential 和 exchange code
  -> Tori callback: state + code

Tori callback
  -> Tori Proxy: exchange code
  <- Tori Proxy: provider account + credential reference material
  -> Tori connection module: create/update connection
  -> Browser popup: notify opener

Tori Web
  -> refresh connection list
```

## 步骤一：启动连接

Tori Web 请求：

```ts
type StartConnectRequest = {
  proxyInstanceId: string;
  provider: string;
  accessMode: "proxy-token" | "mixed";
};
```

Tori API 必须校验：

- 用户已登录。
- proxy instance 存在且可用。
- proxy instance 对当前用户可见或可使用。
- provider 被该 proxy instance 支持。
- pending session 数量在限制内。

Tori API 返回：

```ts
type StartConnectResponse = {
  sessionId: string;
  state: string;
  connectUrl: string;
  expiresAt: string;
};
```

Tori Web 不直接拼接 callback 细节。`connectUrl` 必须由 Tori API 生成，并携带 Tori Proxy 启动外部连接所需的 `sessionId`、`state`、`provider`、`callbackUrl` 和权限请求。

## 步骤二：Proxy 授权

Tori Proxy 接收：

```ts
type ProxyExternalConnectRequest = {
  sessionId: string;
  provider: string;
  state: string;
  callbackUrl: string;
  label?: string;
  permissions?: string[];
};
```

Tori Proxy 必须校验：

- provider 存在。
- callback URL 被允许。
- sessionId 存在且和 callback URL、state 一起原样保留。
- state 原样保留。
- requested permissions 被支持。

Tori Proxy 拥有 provider auth UI、账号选择和账号确认。

## 步骤三：交换一次性 code

Tori Proxy 重定向到 Tori callback：

```ts
type ToriConnectCallback =
  | { sessionId: string; state: string; code: string }
  | { sessionId: string; state: string; error: string; errorDescription?: string };
```

code 必须：

- 只能消费一次。
- 短效。
- 绑定 state。
- 绑定 proxy-side credential result。

Tori callback 必须校验：

- session 存在。
- session 是 pending。
- session 未过期。
- callback state 等于 session state。
- proxy instance 仍可用。

随后 Tori 通过服务端到服务端请求调用 Tori Proxy exchange：

```ts
type ProxyExchangeRequest = {
  sessionId: string;
  code: string;
  state: string;
};
```

```ts
type ProxyExchangeResponse = {
  providerAccount: {
    provider: string;
    id: string;
    name: string | null;
    avatarUrl?: string | null;
  };
  credential: {
    ref: string;
    permissions: string[];
  };
  proxyConnection: {
    id: string;
    displayName: string | null;
  };
};
```

Tori 不能接受浏览器声明的 provider account identity。Tori 只信任服务端到服务端的 exchange response。

## 步骤四：写入 Tori connection

Tori 写入或更新 connection 时使用：

- connect session 中的 owner user id。
- connect session 和 exchange response 中的 provider。
- exchange response 中的 provider account id。
- connect session 中的 proxy instance id。
- exchange response 中的 credential ref。

唯一性由 Tori connection module 定义。至少必须避免同一 owner/provider/provider account/access mode 出现重复 active connection。

如果已有 public-id connection 是否升级为 proxy-backed connection，这是 Tori connection module 的决策，不是协议假设。

## 步骤五：通知 Browser

Tori callback page 发送：

```ts
type TokenProxyConnectBrowserMessage =
  | {
      type: "tori:token-proxy-connect";
      state: string;
      status: "completed";
      connection: {
        id: string;
        provider: string;
        providerAccountId: string;
        providerAccountName: string | null;
        proxyInstanceId: string;
        accessMode: "proxy-token" | "mixed";
      };
    }
  | {
      type: "tori:token-proxy-connect";
      state: string;
      status: "failed" | "expired" | "cancelled";
      error: string;
    };
```

Tori Web 必须忽略 state 不匹配的消息。

## 错误契约

JSON 协议错误使用：

```ts
type ProtocolError = {
  error: string;
  errorDescription?: string;
};
```

推荐错误码：

- `invalid_request`
- `unauthorized`
- `not_found`
- `expired`
- `conflict`
- `proxy_unavailable`
- `provider_auth_failed`
- `exchange_failed`

## 安全要求

- `state` 必须存在，且 Tori 和 Tori Proxy 都必须校验。
- `sessionId` 必须绑定 `state`、callback URL 和 exchange code。
- Tori Proxy 不能把 provider API key 或 provider token 放入 URL。
- Exchange code 必须单次消费且短效。
- Tori callback 只信任服务端到服务端的 exchange data。
- Tori 只保存 credential reference，不保存 provider token 明文。
- Browser message 必须包含 state。
- Tori Web 必须忽略 state 不匹配的消息。
- Tori Proxy 应限制 callback origin。

## 非目标

本协议不负责：

- 定义 provider 专属 auth 细节。
- 定义 provider data-plane API。
- 要求 Tori 保存 provider credential。
- 定义 Dashboard UI layout，除了 popup 完成行为。
