# Bot Arch

## Runtime

Bot runtime 接收外部平台消息，调用 Tori bot-ingress，并将 Tori 响应渲染回外部平台。

## Flow

```txt
External platform update
  -> Bot runtime
  -> Tori bot-ingress
  -> command response
  -> Bot renderer
  -> External platform API
```

Notification delivery:

```txt
Tori notification delivery
  -> Bot runtime endpoint
  -> platform renderer
  -> External platform API
```

## Trust

Bot runtime 使用可信 bot credential 调用 Tori。Tori 中的 bot instance 由 admin 管理。

## Storage

Bot runtime 可以有自己的运行时配置。Tori 业务资源不存放在 Bot runtime 中。
