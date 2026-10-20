FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    UPLOAD_DIR=/data/uploads
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# The site runs as the unprivileged "node" user, so a bug in it (or in an image decoder) can't take
# over the machine. Fly mounts the /data volume owned by root, so first hand anything there that
# isn't already node's over to it (cheap after the first boot), then drop to node for good.
CMD ["sh", "-c", "mkdir -p \"$DATA_DIR\" \"$UPLOAD_DIR\" && find \"$DATA_DIR\" ! -user node -exec chown node:node {} + && exec setpriv --reuid=node --regid=node --init-groups node server.js"]
