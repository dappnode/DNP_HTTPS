import { config } from "../config";
import fs from "fs";
import axios from "axios";
import { createPrivateKey, X509Certificate } from "crypto";

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
  const response = await axios.postForm<string>(url, {
    csr: file,
  });
  return response.data;
}

export default async function apiSign() {
  const privateKey = createPrivateKey(fs.readFileSync(config.keyPath));
  const timestamp = Math.floor(Date.now() / 1000);
  const [signature, address] = await getEthSignature(timestamp);
  const force = process.env["FORCE"] === "true" || false;

  let certificate = await executeAPISign(signature, address, timestamp, force);
  if (!new X509Certificate(certificate).checkPrivateKey(privateKey) && !force) {
    console.warn("Keys do not match, trying forcing certification service");
    certificate = await executeAPISign(signature, address, timestamp, true);
  }
  if (!new X509Certificate(certificate).checkPrivateKey(privateKey)) {
    throw new Error("Signed certificate does not match the domain private key");
  }

  // Keep the current certificate intact until a matching replacement is ready.
  const pendingPath = `${config.certPath}.tmp`;
  fs.writeFileSync(pendingPath, certificate);
  fs.renameSync(pendingPath, config.certPath);
}
