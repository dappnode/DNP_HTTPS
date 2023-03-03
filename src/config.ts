import path from "path";

const domainsDir = process.env.DOMAINS_DIR || "./domains_dir";
const certBaseDir =
  process.env.CERT_BASE_DIR || "/etc/ssl/dappnode/wildcard_certs";
const nginxDir = process.env.NGINX_PATH || "/etc/nginx";
const dummyBaseDir = path.join(certBaseDir, "default");

export const config = {
  db_filepath: path.join(domainsDir, "domains.json"),
  maximum_domain_length: parseInt(
    process.env.SERVER_NAMES_HASH_BUCKET_SIZE || "128"
  ),
  certMarginDays: parseInt(process.env.MARGIN_DAYS) || 30,
  nginxDir: nginxDir,
  nginxConfigPath: path.join(nginxDir, "nginx.conf"),
  serverConfigDir: path.join(nginxDir, "conf.d"),
  certBaseDir: certBaseDir,
  dhparamPath: path.join(certBaseDir, "dhparam.pem"),
  csrPath: path.join(certBaseDir, "domain.csr"),
  keyPath: path.join(certBaseDir, "domain.key"),
  certPath: path.join(certBaseDir, "signed.crt"),
  dummyBaseDir: dummyBaseDir,
  dummyCert: path.join(dummyBaseDir, "default.pem"),
  dummyKey: path.join(dummyBaseDir, "default.key"),
  certCheckInterval:
    parseInt(process.env.CERT_CHECK_INTERVAL) || 24 * 3600 * 1000,
  mappingExternalByDefault:
    process.env.MAPPING_EXTERNAL_BY_DEFAULT === "true" || false,
};
