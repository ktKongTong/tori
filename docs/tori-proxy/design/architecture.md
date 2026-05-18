# Tori Proxy 架构设计

## 运行时角色

Tori Proxy 是 provider auth、credential storage、token refresh 和 provider data-plane 的执行边界。

## 服务组合

主要 route group：

- health
- oauth
- admin
- proxy
- account
- provider-specific routes such as steam-family

## 模块形态

```txt
route
  -> provider registry
  -> repository
  -> provider API
```

## 存储所有权

Tori Proxy 拥有：

- proxy-side connection
- credential
- auth session
- auth code
- API key
- permission
- proxy rule
- request log
- system task
- refresh log

## 外部连接

- Tori：external connect session、callback exchange、credential reference。
- Provider：OAuth、refresh、provider-specific API。
- Browser popup：existing token selection 和 new token auth。
