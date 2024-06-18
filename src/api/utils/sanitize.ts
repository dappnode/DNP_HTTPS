import { config } from "../../config";
import { BadRequestError } from "./asyncHandler";
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
export function sanitizeTo(to: string): string {
  try {
    if (!to) throw Error("not defined");
  } catch (e) {
    throw new BadRequestError(`Bad param 'to': ${e.message}`);
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

export function sanitizeAuth(auth: string): string {
  if (!auth || typeof auth !== "string") {
    return "";
  }
  const parts = auth.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BadRequestError("Invalid auth format. Expected 'user:password'.");
  }
  const [user, password] = parts.map((part) => part.trim());
  return `${user}:${password}`;
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
