# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for the NestJS auth microservice.
# Stage 1 ("builder") installs full deps and compiles TypeScript via `nest build`.
# Stage 2 ("runner") ships only the compiled output + production dependencies
# on a slim Alpine image, runs as a non-root user, and forwards signals
# through dumb-init so SIGTERM works cleanly in container orchestrators.

ARG NODE_VERSION=22-alpine

# ---------- builder ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Install dependencies with the lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci

# Bring in the rest of the source and build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build \
 && npm prune --omit=dev

# ---------- runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production

# dumb-init forwards signals to the Node process (graceful shutdown in k8s).
RUN apk add --no-cache dumb-init

# Run as the built-in non-root "node" user that the node:alpine image ships with.
USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node package.json ./

EXPOSE 3000

# Container-level healthcheck; orchestrators (k8s, ECS) typically override
# this with their own probes pointed at /health/livez and /health/readyz.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health/livez || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
