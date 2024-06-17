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

const enum ApiSignResponse {
  SUCCESS,
  RATE_LIMITED,
  ERORR
}

async function executeAPISign(
  signature: string,
  address: string,
  timestamp: number,
  force: boolean
) : Promise<ApiSignResponse> {
  const certapi_url = process.env["CERTAPI_URL"];
  const url = `http://${certapi_url}/?signature=${signature}&address=${address}&timestamp=${timestamp}&force=${
    force ? 1 : 0
  }`;
  const file = fs.createReadStream(config.csrPath);
    try {
      const response = await axios.postForm(url, {
        csr: file,
      });
      await fs.writeFileSync(config.certPath, response.data);
      return ApiSignResponse.SUCCESS;
    } catch(e) {
      console.log("Call to Certificate Server failed: ", e.message)
      if(e.response && e.response.status === 429) {
        return ApiSignResponse.RATE_LIMITED;        
      } 
      return ApiSignResponse.ERORR;
    }
}

export default async function apiSign() {
  while(true) { // It's fine to have infinite loop here as without certs nothing works. Loop has to be around everything because we need to sign current timestamp.
    const timestamp = Math.floor(Date.now() / 1000);
    const [signature, address] = await getEthSignature(timestamp);
    const force = process.env["FORCE"] === "true" || false;

    const response = await executeAPISign(signature, address, timestamp, force);
    if(response === ApiSignResponse.RATE_LIMITED) {
      console.log("Call to the DAppNode API rate limited, waiting for an hour to retry");
      await new Promise(f => setTimeout(f, 1000 * 60 * 60)); // Waiting for a hour for rate limit errors
      continue;
    } else if(response === ApiSignResponse.ERORR) {
      await new Promise(f => setTimeout(f, 1000 * 60)); // Waiting for a minute for unspecified errors
      continue;
    }

    const cert_pubkey = shell(
      `openssl x509 -pubkey -noout -in ${config.certPath}`
    );
    const priv_pubkey = shell(`openssl rsa -in ${config.keyPath} -pubout`);
    if (cert_pubkey !== priv_pubkey) {
      console.warn("Keys do not match, trying forcing certification service");
      const response = await executeAPISign(signature, address, timestamp, true);
      if(response === ApiSignResponse.SUCCESS) return;
      else if(response === ApiSignResponse.RATE_LIMITED) {
        console.log("Call to the DAppNode API rate limited, waiting for an hour to retry");
        await new Promise(f => setTimeout(f, 1000 * 60 * 60)); // Waiting for a hour for rate limit errors
        continue;
      } else if(response === ApiSignResponse.ERORR) {
        await new Promise(f => setTimeout(f, 1000 * 60)); // Waiting for a minute for unspecified errors
        continue;
      }
    }
  }
}
