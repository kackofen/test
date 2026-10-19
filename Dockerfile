FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY tools ./tools
COPY public ./public
# bake the stadium-intro photos into the image (optional – the game falls back to Wikimedia)
RUN node tools/fetch-intro-images.mjs || true
ENV PORT=8090 DATA_DIR=/data NODE_ENV=production
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8090
CMD ["node", "server/server.js"]
