# HTTPS-v2

This package serves as proxy server to DAppNodes packages.
<p align="center"><a href="#"><img width="150" title="HTTPS" src='https-portal-avatar.png' /></a></p>

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
