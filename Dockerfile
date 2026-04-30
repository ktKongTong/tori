# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-alpine
ARG BUN_IMAGE=oven/bun:alpine
ARG DENO_IMAGE=denoland/deno:alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/web/package.json ./apps/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY packages/api-kit/package.json ./packages/api-kit/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/observability/package.json ./packages/observability/package.json
COPY packages/storage/package.json ./packages/storage/package.json
COPY packages/task/package.json ./packages/task/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/db/package.json ./packages/db/package.json
RUN pnpm install --frozen-lockfile

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN corepack enable
ARG RUNTIME=node
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=deps /app/packages/api-kit/node_modules ./packages/api-kit/node_modules
COPY --from=deps /app/packages/protocol/node_modules ./packages/protocol/node_modules
COPY --from=deps /app/packages/observability/node_modules ./packages/observability/node_modules
COPY --from=deps /app/packages/storage/node_modules ./packages/storage/node_modules
COPY --from=deps /app/packages/task/node_modules ./packages/task/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN case "$RUNTIME" in \
    node) pnpm --filter web build ;; \
    bun) pnpm --filter web build:bun ;; \
    deno) pnpm --filter web build:deno ;; \
    *) echo "Unsupported RUNTIME=$RUNTIME. Use node, bun, or deno." >&2; exit 1 ;; \
  esac

FROM ${BUN_IMAGE} AS runner-bun
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/apps/web/.output ./.output
EXPOSE 3000
CMD ["bun", "./.output/server/index.mjs"]

FROM ${DENO_IMAGE} AS runner-deno
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=builder --chown=deno:deno /app/apps/web/.output ./.output
USER deno
EXPOSE 3000
CMD ["run", "--unstable-cron", "--allow-net", "--allow-env", "--allow-read", ".output/server/index.mjs"]

FROM ${NODE_IMAGE} AS runner-node
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
RUN addgroup -S nitro && adduser -S nitro -G nitro
COPY --from=builder --chown=nitro:nitro /app/apps/web/.output ./.output
USER nitro
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
