# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
ARG APP_VERSION=0.0.0-local
ENV APP_VERSION=${APP_VERSION}
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN set -e; \
    BUILD_VERSION="$APP_VERSION"; \
    if [ -f dist/version.txt ]; then BUILD_VERSION="$(cat dist/version.txt)"; fi; \
    mkdir -p dist; \
    echo "$BUILD_VERSION" > dist/version.txt; \
    APP_VERSION="$BUILD_VERSION" npm run build:ci

FROM base AS runtime
ARG APP_VERSION=0.0.0-local
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY src ./src
COPY --from=build /app/dist ./dist
ENV PORT=5173 \
    STATIC_DIR=/app/dist \
    BOARD_DATA_FILE=/data/board.json \
    APP_VERSION=${APP_VERSION}
EXPOSE 5173
VOLUME ["/data"]
CMD ["node", "--import", "tsx", "src/server.ts"]
