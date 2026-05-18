# 协议设计

本目录记录目标状态的跨组件协议设计。

协议设计只描述 Tori、Tori Proxy、Bot、Browser 和外部平台 runtime 之间的契约。Tori 内部模块事件、资源生命周期命令、落地计划和问题清单不放在这里。

## 文档索引

- [architecture.md](architecture.md)：协议族、数据权威、通信方向和责任边界。
- [tori-token-proxy-connect.md](tori-token-proxy-connect.md)：Tori、Tori Proxy 和浏览器弹窗之间的外部连接目标协议。
- [tori-bot-ingress.md](tori-bot-ingress.md)：Bot runtime 调用 Tori command ingress 的目标协议。
- [bot-delivery.md](bot-delivery.md)：Tori 向 Bot runtime 投递业务事件的目标协议。
