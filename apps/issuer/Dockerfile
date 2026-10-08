# Build context: the digital-wallet/ workspace root.
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/issuer/package.json apps/issuer/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter "@dw/issuer..."
COPY packages/types packages/types
COPY apps/issuer apps/issuer
# The API address is compiled into the bundle, so it must be known at build time.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL build arg is required" && exit 1)
RUN pnpm --filter @dw/issuer build

FROM nginx:1.27-alpine
COPY apps/issuer/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/issuer/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
