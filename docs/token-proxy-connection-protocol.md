# Token-Proxy Connection Protocol

本文档定义 Tori、token-proxy、浏览器弹窗之间的连接协议。目标是让用户在 Tori Dashboard 里选择一个 `proxyInstance` 后，通过 token-proxy 完成 provider 授权，并由 Tori 后端写入 `connection`。

## 参与方

- **Tori Web**：用户正在操作的 Dashboard 页面。负责选择 `provider` 和 `proxyInstance`，打开授权窗口，接收完成通知并刷新列表。
- **Tori API**：Tori 后端。负责创建连接会话、校验 callback、写入 `connection`。
- **token-proxy Web/API**：proxy instance 对应的外部服务。负责 provider 授权、账号选择、生成 proxy-side credential。
- **Provider**：外部账号提供方，例如 Steam。

## 核心实体

### Proxy Instance

`proxyInstance` 是 Tori 对 token-proxy 节点的登记记录。

Tori 需要使用的字段：

```ts
type ProxyInstance = {
  id: string;
  ownerUserId: string;
  provider: string;
  name: string | null;
  baseUrl: string;
  status: string;
  healthStatus: string;
  capabilities: unknown | null;
  metadata: unknown | null;
};
```

### Connect Session

`connectSession` 是 Tori 后端创建的短效会话，用来绑定一次 popup 授权流程。

```ts
type TokenProxyConnectSession = {
  id: string;
  state: string;
  ownerUserId: string;
  proxyInstanceId: string;
  provider: string;
  status: "pending" | "completed" | "failed" | "expired";
  callbackUrl: string;
  tokenProxyConnectUrl: string;
  expiresAt: string;
  completedAt: string | null;
  error: string | null;
};
```

### Tori Connection

授权完成后，Tori 写入的 `connection` 应表达“这个 Tori 用户通过哪个 proxy instance 连接了哪个 provider account”。

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
  isDefault: boolean;
  status: "active";
  metadata: {
    source: "token-proxy-connect";
    tokenProxyConnectionId: string;
    tokenProxyProvider: string;
    tokenProxyDisplayName?: string | null;
    tokenProxyPermissions?: string[];
  };
};
```

`providerAccountId` 必须使用 provider 侧稳定账号 ID，例如 Steam 使用 SteamID。`tokenProxyConnectionId` 是 token-proxy 内部 credential connection ID，不等同于 Tori connection ID。

## 总体流程

```txt
Tori Web
  -> Tori API: start connect session
  <- Tori API: popup URL
  -> Browser: window.open(popup URL)

Popup / token-proxy
  -> token-proxy: begin provider auth
  -> Provider: user auth / scan / login
  <- Provider: auth completed
  -> token-proxy: user selects account and confirms
  -> token-proxy: create proxy credential
  -> Browser: redirect popup to Tori callback URL with state + code

Tori callback
  -> token-proxy: exchange code for credential result
  -> Tori DB: create/update connection
  -> Popup page: postMessage/BroadcastChannel completed result

Tori Web
  <- Popup page: completed result
  -> Tori API: refetch connections
```

## Step 1: Tori Web starts a connect session

Tori Web 不直接拼 token-proxy callback 细节。它只调用 Tori API，让后端生成 `state`、保存 pending session，并返回可打开的 token-proxy URL。

### Request

```http
POST /api/integration/proxy-instances/:proxyInstanceId/connections/start
Content-Type: application/json
```

```json
{
  "provider": "steam",
  "accessMode": "proxy-token"
}
```

### Tori API validation

Tori API 必须校验：

- 当前用户已登录。
- `proxyInstanceId` 存在。
- `proxyInstance.status === "active"`。
- `proxyInstance.healthStatus` 允许发起连接。
- `provider` 被该 proxy instance 支持。
- 同一用户、同一 proxy instance、同一 provider 的 pending session 数量受限。

### Tori API generated data

```ts
const state = cryptoRandomId();
const sessionId = uniqueId();
const callbackUrl =
  `${toriOrigin}/api/integration/connections/token-proxy/callback` +
  `?sessionId=${sessionId}&state=${state}`;
```

`state` 必须是不可预测随机值。`sessionId` 用于定位 Tori pending session。`state` 用于防止 callback 串线。

### Response

```json
{
  "sessionId": "conn_sess_01H...",
  "state": "9b871d3d-6a48-4d40-8bb5-7bc8c07f4e1f",
  "connectUrl": "https://proxy.example.com/admin/external-connect?provider=steam&state=9b...&callback=https%3A%2F%2Ftori.example.com%2Fapi%2Fintegration%2Fconnections%2Ftoken-proxy%2Fcallback%3FsessionId%3Dconn_sess_01H...%26state%3D9b...",
  "expiresAt": "2026-05-10T08:30:00.000Z"
}
```

## Step 2: Tori Web opens popup

Tori Web 使用 `connectUrl` 打开新窗口。

```ts
const popup = window.open(connectUrl, "tori-token-proxy-connect", "popup,width=720,height=860");
```

Tori Web 同时监听两种完成通知：

- `window.message`
- `BroadcastChannel("tori-token-proxy-connect:" + state)`

消息格式：

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

Tori Web 收到 `completed` 后刷新：

```ts
queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
```

## Step 3: token-proxy accepts external connect

token-proxy 需要提供一个 browser-facing external connect endpoint。这个 endpoint 可以复用现有 admin connect UI，但必须接受外部 callback 参数。

### Request

```http
GET /admin/external-connect?provider=steam&state=:state&callback=:callbackUrl
```

可选参数：

```txt
label=Tori
permissions=proxy,account,steam-family
```

### token-proxy validation

token-proxy 必须校验：

- `provider` 存在。
- provider 支持当前 connect flow。
- `callback` 是合法 URL。
- 如果 token-proxy 配置了 allowed callback origins，则 callback origin 必须在 allowlist 内。
- `state` 必须原样保留，不能重新生成覆盖。

### token-proxy session

token-proxy 创建自己的 auth session：

```ts
type TokenProxyAuthSession = {
  id: string;
  provider: string;
  state: string;
  callbackUrl: string;
  status: "pending" | "completed" | "failed" | "expired";
  challengeData: unknown;
  requestedConnection: {
    label: string | null;
    permissions: string[];
  };
  expiresAt: number;
};
```

## Step 4: Provider auth and account selection

token-proxy UI 负责 provider 授权，并在授权成功后展示可连接账号。

如果 provider 只返回一个账号，token-proxy 可以直接展示确认页。如果 provider 返回多个账号，用户必须选择一个账号。

账号选择结果：

```ts
type SelectedProviderAccount = {
  provider: string;
  providerUid: string;
  displayName: string | null;
  avatarUrl?: string | null;
  rawProfile?: unknown;
};
```

用户点击 Confirm 后，token-proxy 创建 proxy credential connection。

```ts
type TokenProxyConnection = {
  id: string;
  provider: string;
  providerUid: string;
  displayName: string | null;
  permissions: string[];
  apiKey: string;
  status: "active";
  createdAt: number;
};
```

## Step 5: token-proxy redirects to Tori callback

token-proxy 不应该把 `apiKey` 直接放进 URL。推荐使用一次性 code。

### One-time code

token-proxy 创建短效 code：

```ts
type TokenProxyExchangeCode = {
  code: string;
  connectionId: string;
  state: string;
  expiresAt: number;
  consumed: boolean;
};
```

### Redirect

```http
302 Location: https://tori.example.com/api/integration/connections/token-proxy/callback?sessionId=conn_sess_01H...&state=9b...&code=tp_code_01H...
```

失败时：

```http
302 Location: https://tori.example.com/api/integration/connections/token-proxy/callback?sessionId=conn_sess_01H...&state=9b...&error=access_denied&error_description=User%20cancelled
```

## Step 6: Tori callback exchanges code

### Request

```http
GET /api/integration/connections/token-proxy/callback?sessionId=:sessionId&state=:state&code=:code
```

### Tori callback validation

Tori API 必须校验：

- `sessionId` 存在。
- session status 是 `pending`。
- session 未过期。
- query `state` 等于 session `state`。
- session 的 `proxyInstanceId` 仍然存在且可用。

如果 query 包含 `error`，Tori 标记 session failed，并返回失败 callback page。

### Server-to-server exchange

Tori API 使用 `proxyInstance.baseUrl` 请求 token-proxy exchange endpoint。

```http
POST https://proxy.example.com/admin/external-connect/exchange
Content-Type: application/json
```

```json
{
  "code": "tp_code_01H...",
  "state": "9b871d3d-6a48-4d40-8bb5-7bc8c07f4e1f"
}
```

### Exchange response

```json
{
  "connection": {
    "id": "tp_conn_01H...",
    "provider": "steam",
    "providerUid": "76561198000000000",
    "displayName": "kt",
    "permissions": ["proxy", "account", "steam-family"],
    "status": "active",
    "createdAt": 1778400000
  },
  "apiKey": "tp_live_...",
  "account": {
    "providerAccountId": "76561198000000000",
    "providerAccountName": "kt",
    "providerAccountAvatar": null
  }
}
```

token-proxy exchange 规则：

- `code` 只能消费一次。
- `code` 过期后返回 `410 Gone`。
- `state` 不匹配返回 `400 Bad Request`。
- 成功后立即标记 consumed。

## Step 7: Tori writes connection

Tori API 通过专用 command 写入 connection，例如：

```ts
completeTokenProxyConnection(ctx, {
  sessionId,
  proxyInstanceId,
  provider,
  providerAccountId,
  providerAccountName,
  providerAccountAvatar,
  tokenProxyConnectionId,
  tokenProxyApiKey,
  permissions,
});
```

写入规则：

- 唯一性基于 `ownerUserId + provider + providerAccountId`。
- 如果不存在，创建新 connection。
- 如果已存在 public-id connection，可以升级为 proxy-backed connection，或返回 conflict；该策略必须在 command 内固定。
- 如果已存在同一个 `proxyInstanceId + tokenProxyConnectionId`，返回幂等成功。
- `accessMode` 默认写 `"proxy-token"`；如果仍允许 public-id fallback，写 `"mixed"`。
- `proxyInstanceId` 必须写入 connection 顶层字段。
- `tokenProxyConnectionId` 写入 `metadata`。
- `tokenProxyApiKey` 不进入普通 metadata；应该写入 credential store，metadata 只保存 credential ref。

推荐 metadata：

```json
{
  "source": "token-proxy-connect",
  "tokenProxyConnectionId": "tp_conn_01H...",
  "tokenProxyCredentialRef": "credential_ref_01H...",
  "tokenProxyPermissions": ["proxy", "account", "steam-family"]
}
```

## Step 8: Tori callback page notifies opener

Tori callback endpoint 返回 HTML。该 HTML 不展示业务 UI，只负责通知 opener 并关闭窗口。

成功消息：

```js
const message = {
  type: "tori:token-proxy-connect",
  state: "9b871d3d-6a48-4d40-8bb5-7bc8c07f4e1f",
  status: "completed",
  connection: {
    id: "conn_01H...",
    provider: "steam",
    providerAccountId: "76561198000000000",
    providerAccountName: "kt",
    proxyInstanceId: "proxy_01H...",
    accessMode: "proxy-token",
  },
};

window.opener?.postMessage(message, window.location.origin);
new BroadcastChannel("tori-token-proxy-connect:" + message.state).postMessage(message);
window.close();
```

失败消息：

```js
const message = {
  type: "tori:token-proxy-connect",
  state: "9b871d3d-6a48-4d40-8bb5-7bc8c07f4e1f",
  status: "failed",
  error: "token-proxy exchange failed",
};
```

## Endpoint Summary

### Tori API

```txt
POST /api/integration/proxy-instances/:proxyInstanceId/connections/start
GET  /api/integration/connections/token-proxy/callback
```

### token-proxy

```txt
GET  /admin/external-connect
POST /admin/external-connect/exchange
```

Existing token-proxy internal endpoints may remain:

```txt
POST /admin/connections/connect
GET  /admin/connections/connect/:sid
```

External connect can wrap or reuse the internal connect session, but its browser contract must be callback-driven.

## Error Contract

All JSON protocol errors use:

```json
{
  "error": "invalid_request",
  "error_description": "state does not match connect session"
}
```

Recommended error codes:

- `invalid_request`
- `unauthorized`
- `not_found`
- `expired`
- `conflict`
- `proxy_unavailable`
- `provider_auth_failed`
- `exchange_failed`

## Security Rules

- `state` is mandatory and must be checked by both Tori and token-proxy.
- token-proxy must not put `apiKey` in URL query.
- Exchange `code` is single-use and short-lived.
- Tori callback must not trust browser-provided account fields without exchange verification.
- Tori should store token-proxy credentials through a credential ref, not plain metadata.
- popup message must include `state`; opener must ignore messages with mismatched state.
- If token-proxy supports callback allowlist, Tori origin must be registered before use.

## Minimal Happy Path Example

1. User selects:

```json
{
  "provider": "steam",
  "proxyInstanceId": "proxy_01H..."
}
```

2. Tori Web starts session:

```http
POST /api/integration/proxy-instances/proxy_01H.../connections/start
```

3. Tori API returns:

```json
{
  "sessionId": "conn_sess_01H...",
  "state": "9b871d3d-6a48-4d40-8bb5-7bc8c07f4e1f",
  "connectUrl": "https://proxy.example.com/admin/external-connect?...",
  "expiresAt": "2026-05-10T08:30:00.000Z"
}
```

4. Browser opens popup at `connectUrl`.

5. token-proxy completes provider auth and redirects:

```txt
https://tori.example.com/api/integration/connections/token-proxy/callback?sessionId=conn_sess_01H...&state=9b...&code=tp_code_01H...
```

6. Tori callback exchanges code and writes:

```json
{
  "provider": "steam",
  "providerAccountId": "76561198000000000",
  "providerAccountName": "kt",
  "accessMode": "proxy-token",
  "proxyInstanceId": "proxy_01H...",
  "metadata": {
    "source": "token-proxy-connect",
    "tokenProxyConnectionId": "tp_conn_01H...",
    "tokenProxyCredentialRef": "credential_ref_01H..."
  }
}
```

7. Callback page sends:

```json
{
  "type": "tori:token-proxy-connect",
  "state": "9b871d3d-6a48-4d40-8bb5-7bc8c07f4e1f",
  "status": "completed",
  "connection": {
    "id": "conn_01H...",
    "provider": "steam",
    "providerAccountId": "76561198000000000",
    "providerAccountName": "kt",
    "proxyInstanceId": "proxy_01H...",
    "accessMode": "proxy-token"
  }
}
```

8. Tori Web refreshes connection list.
