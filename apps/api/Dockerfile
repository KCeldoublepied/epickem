# Image de l'API NestJS — construite depuis la racine du monorepo :
#   docker build -f apps/api/Dockerfile .

ARG NODE_IMAGE=node:22-slim

# --- base : Node + pnpm (version lue dans le package.json racine) ----------
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- pruner : ne garde du monorepo que ce dont l'API a besoin --------------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.9 prune @epickem/api --docker

# --- builder : installe les dépendances puis compile ------------------------
FROM base AS builder
# 1. Manifestes seuls : cette couche reste en cache tant que les dépendances ne changent pas.
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/.npmrc ./.npmrc
RUN pnpm install --frozen-lockfile
# 2. Sources, puis build de l'API et des packages dont elle dépend.
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo run build --filter=@epickem/api
# 3. Extrait l'API avec ses seules dépendances de production.
RUN pnpm --filter @epickem/api deploy --prod --legacy /prod/api

# --- runner : image finale, légère, sans les sources ni les outils de build --
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=builder --chown=node:node /prod/api ./
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
