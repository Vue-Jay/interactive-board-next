FROM node:24-alpine AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN VITE_LEKTRUS_BACKEND=selfhost VITE_LEKTRUS_API_ORIGIN= npm run build

FROM caddy:2.10.2-alpine AS proxy

FROM python:3.12.10-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 LEKTRUS_ASSETS_DIR=/data/assets HOME=/home/lektrus
WORKDIR /srv/lektrus
COPY server/requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 lektrus \
    && mkdir -p /data
COPY server/*.py ./
COPY server/sql ./sql
COPY --from=web /build/dist /srv/web
COPY --from=proxy /usr/bin/caddy /usr/bin/caddy
COPY deploy/amvera/Caddyfile deploy/amvera/start.sh ./
EXPOSE 8080
ENTRYPOINT ["/bin/bash", "/srv/lektrus/start.sh"]
