# ==============================================================================
# AOTUC-TRANSPORT v2.0 — Production Backend Dockerfile
# Base: Node.js 22 LTS (Debian slim for native argon2 & PostGIS Prisma engines)
# ==============================================================================
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install openssl for Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------------------
# Dependencies Layer
# ------------------------------------------------------------------------------
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# ------------------------------------------------------------------------------
# Production Runner Layer
# ------------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

WORKDIR /app

# Copy production node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src/
COPY assets ./assets/

# Generate Prisma Client for Debian target
RUN npx prisma generate

# Create storage directory for private documents and set non-root permissions
RUN mkdir -p /app/storage/documents && chown -R node:node /app

USER node

EXPOSE 4000

# Health check probe against API health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "src/server.js"]
