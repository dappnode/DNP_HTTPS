import { config } from "../../config";
import { BadRequestError } from "./asyncHandler";
import axios from "axios"
/**
 * from param must be a subdomain
 */
export async function sanitizeFrom(from: string): Promise<string> {
  try {
    if (!from) throw Error("not defined");
    assertIsSubdomain(from);
    assertIsAlphanumeric(from);
  } catch (e) {
    throw new BadRequestError(`Bad param 'from': ${e.message}`);
  }

  return from;
}

/**
 * to param must be a host with maybe a port number
 */
export async function sanitizeTo(to: string): Promise<string> {
  try {
    if (!to) throw Error("not defined");
  } catch (e) {
    throw new BadRequestError(`Bad param 'to': ${e.message}`);
  }

  // probe target with axios. We are actually not interested whether it returns something or not, just that target package is available and that port is correct

  try {
    await axios.get(to, {timeout: 100});
  } catch (e) {
    if(e.message === "ECONNREFUSED") {
      throw new BadRequestError(`Unable to add mapping! Make sure that you are pointing to the open port`);
    }
    if(e.code === "ENOTFOUND") {
      throw new BadRequestError(`Unable to add mapping! Make sure that target package is up and running`);
    }
  }
  return to;
}

export function sanitizeExternal(external: string): boolean {
  if (!external) {
    return config.mappingExternalByDefault;
  }
  if (parseInt(external) > 0 || external.toLowerCase() === "true") {
    return true;
  }
  return false;
}

function assertIsSubdomain(subdomain: string): void {
  if (subdomain.includes(".")) {
    throw Error("Must not be FQDN nor contain any subdomains");
  }
}

function assertIsAlphanumeric(s: string): void {
  if (!/^[a-z0-9\-]+$/i.test(s)) {
    throw Error("Must only contain alphanumeric characters and '-'");
  }
}
