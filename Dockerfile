# syntax=docker/dockerfile:1.7
# PaperVault production image. Targets:
#   runner   (default) the Next.js server, non-root, ~200 MB
#   migrate  one-shot: prisma migrate deploy, then the catalogue seed
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
# Placeholders so `next build` can import server modules; real values are
# injected at runtime and validated by assertEnvironment() on boot.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder-not-used-at-runtime-000" \
    npx prisma generate && npm run build

# Also the place to run one-off admin tasks:
#   docker compose run --rm migrate npm run admin:create
FROM deps AS migrate
COPY . .
CMD ["sh", "-c", "npx prisma migrate deploy && npm run -s db:catalogue"]

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-osd poppler-utils \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app \
  && mkdir -p /app/storage && chown app:app /app/storage
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/healthz').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
