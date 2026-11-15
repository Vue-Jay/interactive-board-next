FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
ENV VITE_LEKTRUS_BACKEND=selfhost
ARG LEKTRUS_SITE_ORIGIN
ENV VITE_LEKTRUS_API_ORIGIN=${LEKTRUS_SITE_ORIGIN}
RUN npm run build

FROM caddy:2.10.2-alpine
COPY deploy/selfhost/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/web
