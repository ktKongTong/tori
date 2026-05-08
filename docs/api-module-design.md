# API Module Design

This document describes the current API and code-organization model for Tori.
The target architecture is a vertical-slice modular monolith: each capability owns its contract, route, command logic, repository port, repository implementations, mapper, and local types.

## Module Classes

Tori backend modules are grouped into three classes.

### Infra

Infra modules provide technical primitives. They do not express product/business capabilities.

Examples:

- `api/domain/infra/db.ts`
- `api/domain/infra/eventing`
- `api/domain/infra/eventing/repository`
- `api/domain/infra/service-context.ts`
- `api/support/repository-container.ts`

Infra may be used by platform modules and business modules. Infra must not import platform or business modules, except for the repository composition root, which is explicitly an application wiring file.

### Platform

Platform modules provide reusable product capabilities. They may depend on infra and may be consumed by top-level business modules.

Current platform capabilities:

- `platform/binding`: identity and channel binding.
- `platform/bot-plugin`: managed bot runtime instances.
- `platform/bot-ingress`: bot command ingress and context.
- `platform/connection`: provider account connections and account profile/family refresh entrypoints.
- `platform/integration`: external proxy/provider registry and proxy instance management.
- `platform/notify`: notification body, endpoint, event, delivery, and stream primitives.
- `platform/subscription`: topic subscription lifecycle and subscription event history.
- `platform/task`: scheduled task definitions and task run history.

Platform modules may depend on other platform modules only when the dependency is explicit and directional. For example, `subscription` can create lifecycle outbox events and use binding/channel concepts, but `notify` must not own subscription persistence.

### Business Modules

Business modules are top-level independent product domains. They may depend on infra and platform, but not on each other.

Current example:

- `api/modules/steam`

Business modules should keep their own domain-specific repository, adapters, schema, command logic, and route definitions inside the module. Shared platform capabilities should be consumed through platform public APIs or `ctx.repositories`, not by importing another business module.

## Standard Module Shape

A standard platform or business module should look like this:

```txt
api/modules/<class>/<module>/
  contract.ts
  type.ts
  command.ts
  route.ts
  mapper.ts
  repository/
    index.ts
    repository.ts
    pg.ts
    sqlite.ts
  *.test.ts
```

Not every module needs every file. For example, modules without external HTTP contracts may not need `contract.ts`; modules without persistence may not need `repository`.

### `contract.ts`

`contract.ts` defines the HTTP/API boundary.

It owns:

- request schemas
- response schemas
- DTO schemas
- DTO types inferred from schemas
- page response schemas for list endpoints

Example names:

```ts
export const subscriptionDtoSchema = z.object(...);
export const subscriptionPageDtoSchema = PageBasedPaginationResultSchema(subscriptionViewDtoSchema);
export type SubscriptionDto = z.infer<typeof subscriptionDtoSchema>;
```

Rules:

- Frontend API clients import schemas and DTO types from `contract.ts`.
- Backend routes use the same schemas for request validation and OpenAPI metadata.
- Do not duplicate zod schemas in frontend files.
- Do not create compatibility `schema.ts` re-export files.
- Do not alias DTOs to fake business names such as `TaskDef = TaskDefinitionDto`.

### `type.ts`

`type.ts` defines module-local business types that are not HTTP contracts and not repository records.

It owns:

- command input types when they differ from DTOs
- event names and event payloads
- module-specific unions and state types

Example:

```ts
export const SUBSCRIPTION_CREATED = "SubscriptionCreated";
export type SubscriptionLifecyclePayload = { ... };
```

Rules:

- Frontend should not import `type.ts`.
- Other modules may import event names or public payload types only when that is the intended integration surface.
- If a type is part of the HTTP boundary, it belongs in `contract.ts`, not `type.ts`.

### `command.ts`

`command.ts` contains orchestration and business use cases.

It owns:

- authorization-sensitive orchestration
- repository calls through `ctx.repositories`
- outbox event creation
- id generation
- business errors
- calls into other platform capability APIs when explicitly allowed

Rules:

- Commands should not import PG/SQLite repository implementations.
- Commands should use `ServiceContext`.
- Commands should prefer repository ports through `ctx.repositories`.
- Commands return business objects, not DTOs, unless the command is explicitly a DTO shaping function. Route/mapper handles DTO shaping.

### `route.ts`

`route.ts` defines HTTP endpoints.

It owns:

- URL path handlers
- `describeRoute` metadata
- request validation through contract schemas
- response shaping through mappers

Rules:

- Routes import schemas from their module `contract.ts`.
- Routes call commands or repositories, then map to DTOs.
- Routes should not contain DB logic.
- Routes should not duplicate DTO schemas inline except for small one-off primitives.

### `mapper.ts`

`mapper.ts` converts internal objects into API DTOs.

It owns:

- BO to DTO conversion
- page result mapping
- `Date` to ISO string conversion
- nullable/default normalization
- aggregate view shaping when the route returns a joined view

Example:

```ts
export function mapSubscriptionPage(
  page: PageBasedPaginationResult<Subscription>,
): PageBasedPaginationResult<SubscriptionViewDto> {
  return { ...page, data: page.data.map(toSubscriptionViewDto) };
}
```

Rules:

- Mappers import repository/domain BOs and contract DTOs.
- Mappers are the only normal place where BO and DTO meet.
- Frontend should never import mappers.

### `repository/repository.ts`

This file defines the repository port and BOs owned by the module.

It owns:

- repository interface
- repository input types
- repository output business objects
- list pagination types

Example:

```ts
export interface ISubscriptionRepository {
  listSubscriptions(
    page: PageBasedPaginationParam,
  ): Promise<PageBasedPaginationResult<Subscription>>;
}
```

Rules:

- Repository ports live with the owning module.
- Do not define platform repository ports under `api/domain/platform/repository/ports`.
- Do not put module repository ports in a global `api/repository` folder.
- Repository BOs may use `Date`, `unknown`, and business-level nullable fields.
- Repository BOs are not DTOs.

### `repository/pg.ts` and `repository/sqlite.ts`

These are infrastructure adapters for the module repository port.

They own:

- Drizzle table access
- SQL joins
- DB-specific pagination mechanics
- DB insert/update/select conversion into repository BOs

Rules:

- They may import DB schema and DB utilities.
- They implement the local `I<Module>Repository`.
- They should not import route, frontend API files, or DTO schemas.
- DBO/projection details should stay inside repository implementations unless a projection is part of the repository port.

### `repository/index.ts`

This is the module repository public export for application wiring.

It usually exports:

```ts
export { SubscriptionPgRepository } from "./pg";
export { SubscriptionSqliteRepository } from "./sqlite";
export type { ISubscriptionRepository } from "./repository";
```

Do not use this file to re-export DTOs or unrelated module internals.

## Composition Root

`api/support/repository-container.ts` is the only place that wires concrete repository implementations into `ServiceContext`.

It may import:

- infra repository implementations
- platform repository implementations
- business module repository implementations, when they are part of `ServiceContext`

It should not own repository definitions. It is a wiring file only.

`api/domain/platform/repository/container.ts` defines the repository container type:

```ts
export type PlatformRepositoryContainer = InfraRepositoryContainer & {
  binding: IBindingRepository;
  connection: IConnectionRepository;
  integration: IIntegrationRepository;
  notify: INotifyRepository;
  subscription: ISubscriptionRepository;
};
```

This type is allowed because it is a service-context shape, not repository ownership.

## Current Platform Boundaries

### `notify`

Owns notification delivery primitives:

- notification body model
- delivery endpoints
- notification events
- delivery candidate creation
- delivery status updates
- SSE notification stream

Does not own:

- subscription creation
- subscription list/detail
- subscription status updates
- subscription event-history route

Those belong to `subscription`.

### `subscription`

Owns subscription lifecycle:

- create subscription
- activate/disable subscription
- list subscriptions
- subscription detail view
- notification event history by subscription
- subscription lifecycle outbox events

It may consume notification event DTOs because subscription history displays notification events, but the ownership remains separate:

- event schema: `notify/contract.ts`
- subscription page/history schema: `subscription/contract.ts`

### `integration`

Owns external proxy/provider integration:

- proxy instance registration
- proxy health probing
- proxy status changes
- provider registry hooks

Does not own:

- provider account connections
- account profile lists
- family refresh HTTP endpoints

Those belong to `connection`.

### `connection`

Owns provider account connections:

- create connection
- list connections
- list account profiles
- resolve connection access
- account profile/family refresh HTTP entrypoints

It may call integration provider registry for provider-specific actions. The direction is `connection -> integration/provider-registry`, not `integration repository -> connection repository`.

## Frontend Import Rules

Frontend feature API files should import only public API boundary contracts:

```ts
import {
  connectionListDtoSchema,
  type ConnectionDto,
} from "@/api/modules/platform/connection/contract";
import {
  proxyInstanceListDtoSchema,
  type ProxyInstanceDto,
} from "@/api/modules/platform/integration/contract";
```

Allowed frontend imports:

- `*/contract.ts`
- UI components
- frontend-local query/API helpers

Disallowed frontend imports:

- `*/command.ts`
- `*/repository/*`
- `*/type.ts`, unless the type is explicitly documented as a frontend-safe public type
- mappers
- DB schema

Frontend view models should be real aggregates, not DTO aliases.

Allowed:

```ts
export type IntegrationConnectionListItem = {
  connection: ConnectionDto;
  proxy: ProxyInstanceDto | null;
  profile: AccountProfileDto | null;
};
```

Disallowed:

```ts
export type BotInstance = BotInstanceDto;
export type TaskDef = TaskDefinitionDto;
export type ClaimSessionRow = ClaimSessionDto;
```

## Backend Import Rules

Routes:

- import contract schemas
- call commands or `ctx.repositories`
- call mappers for response DTOs

Commands:

- import local `type.ts`
- use `ctx.repositories`
- may import event helpers and infra helpers
- do not import repository implementations

Repositories:

- import local repository port
- import DB schema
- import DB utils
- do not import frontend or route code
- generally do not import contract schemas

Business modules:

- may import platform commands/types/routes/contracts when the platform module is the intended dependency
- should not import another business module

## Concept Variants

A single product concept can have several valid type variants. The variants must be explicit and named by boundary.

### DTO

DTOs are API wire types. They live in `contract.ts`.

Properties:

- serializable
- dates are strings
- validated by zod
- safe for frontend use

Example:

```ts
SubscriptionDto;
ConnectionDto;
ProxyInstanceDto;
```

### BO

Business objects are internal module/repository output types. They live in `repository/repository.ts` or occasionally `type.ts`.

Properties:

- may contain `Date`
- may contain internal nullable fields
- may include joined objects for read views
- not directly exposed to frontend

Example:

```ts
Subscription;
Connection;
NotificationEvent;
```

### DBO / DB Projection

DBO is a database row or selected projection.

Properties:

- created by Drizzle schema inference or a repository-local select shape
- should stay inside `repository/pg.ts` or `repository/sqlite.ts`
- should not leak into route, command, frontend, or contract

If a projection must cross the repository port, name it by business meaning, not table mechanics.

Prefer:

```ts
Subscription;
SubscriptionDetail;
NotificationDeliveryCandidate;
```

Avoid:

```ts
NotifyEventRow;
NotifySubscriptionView;
ClaimSessionRow;
```

### Command Input

Command input is use-case input. It lives in `type.ts` when it differs from API DTO.

Properties:

- can be narrower or richer than DTO
- should reflect business use-case needs
- may be constructed by routes from DTOs

Example:

```ts
CreateSubscriptionInput;
RegisterProxyInstanceInput;
```

### Repository Input

Repository input is persistence input. It lives in `repository/repository.ts`.

Properties:

- close to the storage operation
- includes generated ids if command generates them
- not necessarily equal to DTO or command input

Example:

```ts
CreateTaskDefinitionInput;
CreateConnectionInput;
CreateNotificationEventInput;
```

### View Model / List Item

Frontend view models are UI aggregates. They live in feature API/query/columns files.

Properties:

- compose multiple DTOs
- exist only because the UI needs a derived shape
- should not hide a DTO behind another name

Example:

```ts
IntegrationConnectionListItem = {
  connection: ConnectionDto;
  proxy: ProxyInstanceDto | null;
  profile: AccountProfileDto | null;
}
```

## Pagination

List endpoints that can grow must accept page-based pagination.

Backend:

- route uses `PageBasedPaginationParamSchema`
- repository port accepts `PageBasedPaginationParam`
- repository implementation returns `PageBasedPaginationResult<T>`
- mapper maps `PageBasedPaginationResult<BO>` to `PageBasedPaginationResult<DTO>`

Frontend:

- API client accepts `PageBasedPaginationParam`
- query key includes pagination params
- table UI can use `DashboardPagination`

Task run history is not the only paginated case. Binding, bot instances, integration proxy instances, connections, account profiles, subscriptions, and subscription notification history are also paginated.

## API Route Compatibility

Code ownership and URL paths are separate.

Current routes preserve existing public paths:

- `/api/integration/proxy-instances/*` is implemented by `platform/integration`.
- `/api/integration/connections/*` is implemented by `platform/connection`.
- `/api/notification/delivery-endpoints/*` and stream are implemented by `platform/notify`.
- `/api/notification/subscription/*` is implemented by `platform/subscription`.

This keeps clients stable while allowing code ownership to be correct.

## Reasonableness Assessment

### What Is Good

The current direction is reasonable because module ownership is now visible in the filesystem.

When changing subscription behavior, the main files are:

- `platform/subscription/contract.ts`
- `platform/subscription/command.ts`
- `platform/subscription/route.ts`
- `platform/subscription/mapper.ts`
- `platform/subscription/repository/*`

When changing connection behavior, the main files are:

- `platform/connection/contract.ts`
- `platform/connection/command.ts`
- `platform/connection/route.ts`
- `platform/connection/repository/*`

This avoids the previous split where a single capability was scattered across shared contracts, domain ports, global repository implementations, and module routes.

### Remaining Tradeoffs

Routes still preserve legacy public path groups. For example, connection routes are mounted under `/api/integration`. This is acceptable for compatibility, but it means route URL grouping is not identical to code ownership.

Some platform modules still depend on concepts from other platform modules. This is expected, but the direction must remain explicit. Example: `subscription` can use `notify`'s notification event DTO for history output. `notify` should not own subscription writes.

The repository container is still a central list of repositories. That is acceptable as application composition, but it must stay a wiring layer only.

### Risks To Watch

Do not reintroduce `shared/contracts` as a dumping ground. If a contract belongs to a module, keep it in that module.

Do not move all repository ports back to a global `domain/repository/ports` folder. It improves alphabetical neatness but destroys feature locality.

Do not use frontend aliases to rename DTOs. Either consume the DTO directly or define a real aggregate view model.

Do not let `integration` become a general bucket for every external-system concept. Proxy/provider registry and connection/account ownership are separate capabilities.

Do not let `notify` become a general bucket for every message-related concept. Delivery and subscription are separate capabilities.

## Adding A New Capability

For a new platform capability:

1. Create `api/modules/platform/<capability>`.
2. Add `contract.ts` for HTTP schemas and DTOs.
3. Add `type.ts` for local business/event types.
4. Add `repository/repository.ts` for BOs, inputs, and repository port.
5. Add `repository/pg.ts` and `repository/sqlite.ts`.
6. Add `command.ts` for use cases.
7. Add `mapper.ts` if route responses expose DTOs from BOs.
8. Add `route.ts`.
9. Register route in `api/server/routes.ts`.
10. Wire repository implementation in `api/support/repository-container.ts`.
11. Expose frontend calls through the feature API client using only `contract.ts`.

For a new business module:

1. Create `api/modules/<business-domain>`.
2. Keep its repository, route, command, mapper, schema, and adapters inside that module.
3. Depend on platform capabilities explicitly.
4. Do not import another business module directly.
