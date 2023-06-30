import { config } from "../config";
import apiSign from "./apiSign";
import {
  createCSR,
  generateDHParam,
  generateDomainKey,
  generateDummyCert,
  shouldRenew,
} from "./openssl";

export async function ensureValidCert(createIfNotExists = false) {
  if (await shouldRenew(createIfNotExists)) {
    await signCert();
  } else {
    console.log("Certificate valid or not necessary, skip signing");
  }
}

export default async function initCertificateProvider(dappnodeDomain: string) {
  console.log("Certificates provider initializing");
  try {
    console.log("- Creating Dummy certificate");
    await generateDummyCert();
    console.log("- Generating domain key");
    await generateDomainKey();
    console.log("- Generating DH parameters (this may take a while)");
    await generateDHParam();
    console.log("- Creating Certificate signing request");
    await createCSR(dappnodeDomain);
    console.log("Certificates provider initialized");
  } catch (e) {
    console.log(e);
  }

  console.log("Setting cronjob for cert updates");
  setInterval(async () => {
    try {
      await ensureValidCert();
    } catch (e) {
      console.warn(e);
    }
  }, config.certCheckInterval);
}

async function signCert() {
  console.log("- Calling DAppNode API");
  await apiSign();
}
