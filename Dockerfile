# Two images from one build: `api` (the server) and `web` (the Rector's page as plain files).
# Built on the VM with `docker compose build`, see deploy/docker-compose.yml.
# Tags follow the major line; run `docker image inspect` and note the exact version in docs/DEPLOY.md.

# ---- build: install everything, compile the server, build the page ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json tsconfig.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages packages
COPY apps apps
# tsc writes packages/core/dist and apps/api/dist; vite writes apps/web/dist/site.
RUN npx tsc -b && npx vite build apps/web

# ---- api: only what the server runs ----
FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Only the server's own dependencies, none of the tools used to build and test.
RUN npm ci --omit=dev --workspace @evlos/api
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
USER node
# 8081 the Device, 3000 the page API, 3001 the Public Live View. Compose publishes only 8081.
EXPOSE 8081 3000 3001
CMD ["node", "apps/api/dist/index.js"]

# ---- web: the built page, served as files; the edge Caddy sends the pages here ----
FROM caddy:2-alpine AS web
COPY deploy/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist/site /srv
