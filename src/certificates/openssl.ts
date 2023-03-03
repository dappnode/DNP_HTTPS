import path from "path";
import { config } from "../config";
import shell from "../utils/shell";
import fs from "fs";

const keyLength = 2048;

async function isDHParamValid() {
  try {
    await shell(`openssl dhparam -check < ${path}`);
    return true;
  } catch {
    return false;
  }
}

async function certExpiringDate(pem: string) {
  const date = (
    await shell(`openssl x509 -enddate -noout -in ${pem}`)
  ).substring(9);
  return new Date(date);
}

async function generateDHParam() {
  if (fs.existsSync(config.dhparamPath) && isDHParamValid()) {
    console.log("Valid, skipping");
    return;
  };
  await shell(`openssl dhparam -out ${config.dhparamPath} ${keyLength}`);
}

async function generateDomainKey() {
  if (fs.existsSync(config.keyPath)) {
    console.log("Exists, skipping");
    return;
  };
  await shell(`openssl genrsa ${keyLength} > ${config.keyPath}`);
}

async function createCSR() {
  if (fs.existsSync(config.csrPath)) {
    console.log("Exists, skipping");
    return;
  };
  const publicDomain = process.env._DAPPNODE_GLOBAL_DOMAIN;
  await shell(
    `openssl req -new -sha256 -key ${config.keyPath} -subj '/CN=${publicDomain}' -addext 'subjectAltName = DNS:*.${publicDomain}' > ${config.csrPath}`
  );
}

async function shouldRenew(createIfNotExists: boolean) {
  if (!fs.existsSync(config.certPath)) return createIfNotExists;
  return (
    (await certExpiringDate(config.certPath)).getTime() - Date.now() <
    config.certMarginDays * 24 * 3600 * 1000
  );
}

async function generateDummyCert() {
  if (fs.existsSync(config.dummyCert)) {
    console.log("Exists, skipping");
    return;
  }
  await shell(
    `mkdir -p ${config.dummyBaseDir} && openssl req -x509 -newkey  rsa:${keyLength} -nodes  -out ${config.dummyCert}  -keyout ${config.dummyKey}  -days 36500  -batch  -subj "/CN=default-server.example.com"`
  );
}

export {
  createCSR,
  generateDomainKey,
  generateDHParam,
  generateDummyCert,
  shouldRenew,
};
