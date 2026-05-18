# External Connect 设计

## 参与方

- Tori Dashboard
- Tori API
- Browser popup
- Tori Proxy
- Provider auth server

## 会话

Tori 创建 `token_proxy_connection_session`，包含：

- owner user
- proxy instance
- provider
- access mode
- callback URL
- state
- status
- expiration

Tori Proxy 创建自己的 external connect session，绑定 Tori callback 和 state。

## 已有 Token 选择

External connect 页面先展示 Tori Proxy 中已有可用 token。用户可以选择一个已有 provider connection，并确认授权给 Tori。

页面提供新建按钮，用户可以进入 provider auth flow 创建新 token。

## Exchange

Tori Proxy 完成账号确认后生成一次性 code。Tori callback 使用 code 向 Tori Proxy exchange credential result。

Exchange result 包含：

- provider
- providerAccountId
- providerAccountName
- providerAccountAvatar
- tokenProxyConnectionId
- credentialRef
- capabilities

Tori 写入 connection 和 connection credential reference。

## 重放控制

State 和 code 都只能消费一次。重复 callback 返回已完成或失败结果，不创建重复 Tori connection。
