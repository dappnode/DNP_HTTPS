import startAPI from "./api";
import initCertificateProvider from "./certificates";
import prepareNGINX from "./nginx";
import shell from "./utils/shell";
import fs from "fs";
import { config } from "./config";
async function main() {
  if (!process.env._DAPPNODE_GLOBAL_DOMAIN) {
    console.error("DAppManager did not inject enviornment. Quitting.");
    process.exit(1);
  }

  if (!fs.existsSync(config.serverConfigDir)) {
    fs.mkdirSync(config.serverConfigDir);
  }

  if (!fs.existsSync(config.certBaseDir)) {
    fs.mkdirSync(config.certBaseDir);
  }

  await prepareNGINX();
  await initCertificateProvider();
  await shell("nginx -q");
  startAPI();
}

main();
