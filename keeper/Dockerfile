FROM node:20.18-alpine3.20
RUN apk add --no-cache tini
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
USER node
ENV NODE_ENV=production
# tini as PID 1 forwards SIGTERM so the keeper can finish its tick and exit cleanly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx", "src/index.ts"]
