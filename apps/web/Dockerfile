# Image du site web Next.js — construite depuis la racine du monorepo :
#   docker build -f apps/web/Dockerfile .

ARG NODE_IMAGE=node:22-slim

# --- base : Node + pnpm (version lue dans le package.json racine) ----------
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    TURBO_TELEMETRY_DISABLED=1 \
    HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- pruner : ne garde du monorepo que ce dont le web a besoin -------------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.9 prune @epickem/web --docker

# --- builder : installe les dépendances puis compile ------------------------
FROM base AS builder
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/.npmrc ./.npmrc
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
# `output: 'standalone'` (next.config.mjs) produit un serveur autonome dans .next/standalone.
RUN pnpm turbo run build --filter=@epickem/web

# --- runner : uniquement le serveur autonome et les fichiers statiques -----
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
