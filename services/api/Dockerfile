# Build context: the digital-wallet/ workspace root.
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter "@dw/api..."
COPY services/api services/api
RUN pnpm --filter @dw/api build
# Drop dev dependencies now that the build is done.
RUN CI=true pnpm install --frozen-lockfile --prod --filter "@dw/api..."

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=4000 \
    STORAGE_DIR=/data/storage \
    ISSUER_KEYS_DIR=/data/keys
WORKDIR /repo/services/api
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/services/api/node_modules ./node_modules
COPY --from=build /repo/services/api/dist ./dist
COPY --from=build /repo/services/api/drizzle ./drizzle
COPY --from=build /repo/services/api/package.json ./
# Uploaded documents and issuer signing keys live on volumes mounted here.
RUN mkdir -p /data/storage /data/keys && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrate, make sure the issuer and its key exist, then serve.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/database/seed.js && exec node dist/main.js"]
