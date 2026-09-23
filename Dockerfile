# Roundlot service (Railway). Builds the npm workspace `service` only.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY service/package.json service/
RUN npm ci --workspace service --include-workspace-root
COPY service service
RUN npm run build --workspace service && npm prune --omit=dev --workspace service --include-workspace-root

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/service/package.json service/
COPY --from=build /app/service/dist service/dist
USER node
CMD ["node", "service/dist/index.js"]
