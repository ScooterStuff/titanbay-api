# ---- Build stage: install all deps, compile TS, drop dev deps ----
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build && npm prune --omit=dev

# ---- Runtime stage: slim image, prod deps only, non-root ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# node:20-slim ships an unprivileged "node" user.
USER node
EXPOSE 3000

# server.ts runs migrations on boot, then listens.
CMD ["node", "dist/src/server.js"]
