import startAPI from "./api";
import initCertificateProvider from "./certificates";
import prepareNGINX from "./nginx";
import shell from "./utils/shell";
import fs from "fs";
import { config } from "./config";
import axios from "axios";

const dappmanagerAliases = [
  "my.dappnode",
  "dappmanager.dappnode",
  "dappmanager.dnp.dappnode.eth.dappmanager.dappnode"
];

const RETRY_DELAY = 5000;
const MAX_RETRIES = 50;

async function main() {
  const dappnodeDomain = process.env._DAPPNODE_GLOBAL_DOMAIN
    ? process.env._DAPPNODE_GLOBAL_DOMAIN
    : await retrieveDappnodeDomain();

  if (process.env._DAPPNODE_GLOBAL_DOMAIN)
    console.log("Domain retrieved from environment:", dappnodeDomain);

  if (!fs.existsSync(config.serverConfigDir)) {
    fs.mkdirSync(config.serverConfigDir);
  }

  if (!fs.existsSync(config.certBaseDir)) {
    fs.mkdirSync(config.certBaseDir);
  }

  await prepareNGINX();
  await initCertificateProvider(dappnodeDomain);
  await shell("nginx -q");
  startAPI(dappnodeDomain);
}

async function retrieveDappnodeDomain(): Promise<string> {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    for (const alias of dappmanagerAliases) {
      const domain = await fetchDomainFromDappmanagerAlias(alias);

      if (domain) return domain;
    }

    retries++;
    console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
  }

  throw new Error("Max retries reached. Dappnode domain could not be retrieved from dappmanager API.");
}

async function fetchDomainFromDappmanagerAlias(alias: string): Promise<string | null> {
  try {
    const response = await axios.get(`http://${alias}/global-envs/DOMAIN/`);
    if (response.data) {
      console.log("Domain retrieved from Dappmanager API:", response.data);
      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching domain from alias ${alias}:`, error.message);
  }
  return null;
}


main();
