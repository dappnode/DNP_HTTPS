import startAPI from "./api";
import initCertificateProvider from "./certificates";
import prepareNGINX from "./nginx";
import shell from "./utils/shell";
import fs from "fs";
import { config } from "./config";
import axios from "axios";

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
  while (true) {
    try {
      const response = await axios.get(
        "http://my.dappnode/global-envs/DOMAIN/"
      );
      const domain: string = response.data;
      console.log("Domain retrieved from Dappmanager API:", domain);
      return domain; // Return the domain once it is available
    } catch (error) {
      console.error(
        "Error: Dappnode domain could not be retrieved from dappmanager API",
        error.message
      );
      // Retry after 5s delay
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main();
