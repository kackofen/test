FROM node:22-alpine
WORKDIR /app
COPY server.cjs ./
ENV PORT=8091 WEB_DIR=/web
USER node
EXPOSE 8091
CMD ["node", "server.cjs"]
