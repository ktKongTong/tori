# Tori

Tori 是主产品和控制平面，位于 `apps/tori`。

## Owned Scope

- Dashboard
- Auth context
- User binding and channel binding records
- Connection records
- Token-proxy instance registry
- Bot instance registry
- Subscription configuration
- Notification events
- Task definitions and task runs
- Bot ingress API
- Outbox/inbox event processing

## Local Docs

- [requirement/](requirement/README.md)
- [design/](design/README.md)
- [constraint/](constraint/README.md)
- [exec-plan/active/](exec-plan/active/README.md)
- [exec-plan/completed/](exec-plan/completed/README.md)

## Related Protocols

- [../protocol/design/tori-token-proxy-connect.md](../protocol/design/tori-token-proxy-connect.md)
- [../protocol/design/tori-bot-ingress.md](../protocol/design/tori-bot-ingress.md)
- [../protocol/design/bot-delivery.md](../protocol/design/bot-delivery.md)
