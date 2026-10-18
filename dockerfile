# syntax=docker/dockerfile:1

# ---- build ----
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

# Install dependencies first so this layer is cached until a manifest changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/bank-statement-importer/package.json packages/bank-statement-importer/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY packages/models/package.json packages/models/
COPY packages/storage/package.json packages/storage/
# `prepare` (vp config) sets up git hooks, which is pointless in an image.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY . .
# Install scripts were skipped above; run the ones the workspace allows (esbuild, lightningcss).
RUN pnpm rebuild esbuild lightningcss

# The build validates .env.schema, but the workspace .env isn't copied (see .dockerignore).
# The required variables below are placeholders that only satisfy validation; they are set
# for this one command, never reach the runtime stage, and real values are supplied at run time.
# APP_COMPANY is the exception: it is inlined into the bundle.
ARG APP_COMPANY=Venture
RUN APP_COMPANY="$APP_COMPANY" \
    DATABASE_URL_UNPOOLED=postgresql://placeholder:placeholder@localhost/placeholder \
    BETTER_AUTH_SECRET=build-placeholder \
    RESEND_API_KEY=re_placeholder \
    EMAIL_FROM="Placeholder <placeholder@example.com>" \
    pnpm build

# ---- runtime ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app

# The server reads its config through varlock, so the CLI and schema are needed at run time.
# varlock chmods its bundled native helpers on start-up, so the non-root user must own them.
RUN npm install -g varlock@1.23.0 && npm cache clean --force \
    && chown -R node:node /usr/local/lib/node_modules/varlock
COPY .env.schema ./
COPY --from=build /app/.output ./.output
# .env.schema has @generateTsTypes, so varlock rewrites /app/env.d.ts on every start.
# It's redundant at run time but needs a writable /app.
RUN chown node:node /app

USER node
EXPOSE 3000
CMD ["varlock", "run", "--", "node", ".output/server/index.mjs"]
