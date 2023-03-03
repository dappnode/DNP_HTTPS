FROM node:19.1 as builder

WORKDIR /usr/src/app

COPY *.json yarn.lock ./

RUN yarn

COPY ./src ./src
RUN yarn build

FROM node:19.1-alpine
RUN apk add nginx openssl

ENV DOMAINS_DIR=/usr/src/app/domains  \
    DAPPMANAGER_SIGN=http://my.dappnode/sign  \
    RESOLVER=127.0.0.11 \
    GLOBAL_RESOLVER=172.33.1.2 \
    LOCAL_PROXY_DOMAIN=dappnode

WORKDIR /usr/src/app
COPY package.json yarn.lock ./
COPY ./templates ./templates
RUN yarn --production

COPY --from=builder /usr/src/app/build/ ./build/

EXPOSE 8545
CMD [ "node", "build/index" ]