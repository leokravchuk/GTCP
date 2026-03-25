# ─────────────────────────────────────────────────────────────────────────────
# GTCP API — Dockerfile
# Multi-stage: deps → build → production
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Production image ────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copy deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Drop privileges
RUN addgroup -S gtcp && adduser -S gtcp -G gtcp
USER gtcp

EXPOSE 3000
CMD ["node", "src/app.js"]
