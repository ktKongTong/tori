### Bot Runtime

Bot runtime 通过 bot-ingress 调用 Tori：

```txt
External platform
  -> Bot runtime
  -> Tori /api/bot-ingress/*
  -> Tori command/query
  -> Bot response
```

Bot runtime 只能通过协议入口影响 Tori，不能直接拥有 connection、subscription、task 等 Tori 资源。

### Tori Proxy

Tori 通过 token-proxy external connect 和 provider data-plane 使用 Tori Proxy：

```txt
Tori Dashboard
  -> Browser popup
  -> Tori Proxy external connect
  -> Tori callback
  -> Tori connection / credential reference
```

Tori Proxy 拥有 provider credential 和 provider data-plane。Tori 只保存 proxy instance、connection 和 credential reference。
