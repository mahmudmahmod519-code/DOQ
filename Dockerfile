# syntax=docker/dockerfile:1
# DOQ production image (Node.js + Express + EJS). Works on amd64 and arm64 (e.g. Hetzner CAX).

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- 1) dependencies: production only, compiled native modules (bcrypt) if no prebuild ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- 2) runtime ----------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# mysql client: used by docker-entrypoint.sh to wait for the database (and by tasks/cron.js backups)
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-mysql-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/doq-entrypoint

# Upload + backup directories owned by the unprivileged "node" user (uid 1000).
# A new named volume mounted on /app/public/upload inherits this ownership.
RUN chmod 0755 /usr/local/bin/doq-entrypoint \
    && mkdir -p /app/public/upload /app/backups \
    && chown -R node:node /app/public/upload /app/backups

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# The entrypoint ends with `exec "$@"`, so node becomes the main process and receives SIGTERM.
# Compose runs the container with `init: true` (tini) to reap zombies and forward signals.
ENTRYPOINT ["doq-entrypoint"]
CMD ["node", "index.js"]
