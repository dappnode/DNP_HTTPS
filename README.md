# HTTPS-v2

This package serves as proxy server to DAppNodes packages.
<p align="center"><a href="#"><img width="150" title="HTTPS" src='https-portal-avatar.png' /></a></p>

## Development and security updates

Use Node.js `26.12.1` (see `.nvmrc`) and Yarn Classic `1.22.22`:

```sh
nvm use
npm install --global yarn@1.22.22
yarn install --frozen-lockfile
yarn build
yarn lint
yarn lint:ejs
yarn test
```

TypeScript is kept on `6.0.3`, the latest release supported by the current
TypeScript ESLint parser (`>=4.8.4 <6.1.0`).

For [RHSB-2026-012](https://access.redhat.com/security/vulnerabilities/RHSB-2026-012),
the Docker image uses patched Node.js `26.12.1` and requires Alpine's
`ca-certificates` package dated `20261020` or newer. This refreshes both Node's
bundled trust store and the operating system's CA bundle. Rebuild and redeploy
the package to apply these updates to running containers. To refresh the base
image and installed Alpine packages during a local build:

```sh
docker build --pull --no-cache -t dnp-https:local .
```

## Configurable forwarding

API was added through which containers proxied through the package can be dynamically chosen. By default the server listens at port `5000` for `GET` methods `add` and `remove` both of which have `to` and `from` query parameters i.e.

```
GET /add?from=<chosen-subodomain>&to=<internal-resource>
GET /remove?from=<chosen-subodomain>&to=<internal-resource>
```

Where `chosen-subdomain` is the chosen external endpoint for forwarding and `internal-resource` is either the IP or domain that resolves on the internal network.

## DAppNode certificates

When using the DAppNode dyndns service, DNP_HTTPS uses DAppNode's certificate service to get wildcard certificates for the DAppNode dyndns domains which are provided for free. Following environment variable has to be set:
| Name | Value | Description |
| -------------- | --------------------- | ----------------------------- |
| CERTAPI_URL | TBD | URL of remote signing service |
