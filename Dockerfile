# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run compute:version || true
RUN npm run build:ci

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY src ./src
COPY --from=build /app/dist ./dist
ENV PORT=5173 \
    STATIC_DIR=/app/dist \
    BOARD_DATA_FILE=/data/board.json \
    APP_VERSION=0.0.0-local
EXPOSE 5173
VOLUME ["/data"]
CMD ["node", "--import", "tsx", "src/server.ts"]
