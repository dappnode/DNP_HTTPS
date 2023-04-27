import { config } from "../config";
import fs from "fs";
import axios from "axios";
import shell from "../utils/shell";

async function getEthSignature(timestamp: number): Promise<[string, string]> {
  const response = await axios.post(
    process.env.DAPPMANAGER_SIGN,
    timestamp.toString(),
    {
      headers: { "Content-Type": "text/plain" },
    }
  );
  return [response.data.signature, response.data.address];
}

async function executeAPISign(
  signature: string,
  address: string,
  timestamp: number,
  force: boolean
) {
  const certapi_url = process.env["CERTAPI_URL"];
  const url = `http://${certapi_url}/?signature=${signature}&address=${address}&timestamp=${timestamp}&force=${
    force ? 1 : 0
  }`;
  const file = fs.createReadStream(config.csrPath);
  const response = await axios.postForm(url, {
    csr: file,
  });
  await fs.writeFileSync(config.certPath, response.data);
}

export default async function apiSign() {
  const timestamp = Math.floor(Date.now() / 1000);
  const [signature, address] = await getEthSignature(timestamp);
  const force = process.env["FORCE"] === "true" || false;

  await executeAPISign(signature, address, timestamp, force);
  const cert_pubkey = shell(
    `openssl x509 -pubkey -noout -in ${config.certPath}`
  );
  const priv_pubkey = shell(`openssl rsa -in ${config.keyPath} -pubout`);
  if (cert_pubkey !== priv_pubkey) {
    console.warn("Keys do not match, trying forcing certification service");
    await executeAPISign(signature, address, timestamp, true);
  }
}
