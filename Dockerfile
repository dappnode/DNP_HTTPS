FROM node:26.12.1-alpine3.24 AS base

# RHSB-2026-012: refresh the OS trust store as well as Node's bundled CAs.
RUN apk upgrade --no-cache \
    && apk add --no-cache "ca-certificates>=20261020-r0" \
    && update-ca-certificates \
    && npm install --global yarn@1.22.22

FROM base AS builder

WORKDIR /usr/src/app

COPY package.json tsconfig.json yarn.lock ./

RUN yarn install --frozen-lockfile --non-interactive

COPY ./src ./src
RUN yarn build

FROM base AS runtime
RUN apk add --no-cache nginx openssl

ENV DOMAINS_DIR=/usr/src/app/domains  \
    DAPPMANAGER_SIGN=http://my.dappnode/sign  \
    RESOLVER=127.0.0.11 \
    GLOBAL_RESOLVER=172.33.1.2 \
    LOCAL_PROXY_DOMAIN=dappnode

WORKDIR /usr/src/app
COPY package.json yarn.lock ./
COPY ./templates ./templates
COPY ./snippets /etc/nginx/snippets
COPY ./static /usr/share/nginx/html
RUN yarn install --frozen-lockfile --production --non-interactive \
    && yarn cache clean

COPY --from=builder /usr/src/app/build/ ./build/

EXPOSE 8545
CMD [ "node", "build/index" ]
