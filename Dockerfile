FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
COPY docker-entrypoint.sh /usr/local/bin/doq-entrypoint
RUN mkdir -p /app/public/upload /app/backups \
    && chown -R node:node /app \
    && chmod +x /usr/local/bin/doq-entrypoint

USER node
EXPOSE 3000
ENTRYPOINT ["doq-entrypoint"]
CMD ["node", "index.js"]
