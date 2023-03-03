import ejs from "ejs";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { DomainMapping } from "../types";

export async function generateServerConfig(
  mapping: DomainMapping
): Promise<string> {
  const data = {
    certPath: config.certPath,
    keyPath: config.keyPath,
    dhparamPath: config.dhparamPath,
    domain: `${mapping.from}.${process.env._DAPPNODE_GLOBAL_DOMAIN}`,
    target: mapping.to,
    external: mapping.external,
  };
  return await ejs.renderFile("./templates/default.ssl.conf.ejs", {
    data: data,
  });
}

export default async function generateNginxConf() {
  const data = {
    dummyCert: config.dummyCert,
    dummyKey: config.dummyKey,
  };
  await fs.writeFileSync(
    config.nginxConfigPath,
    await ejs.renderFile("./templates/nginx.conf.ejs", { data: data })
  );
}

export async function generateStaticServers() {
  const staticDir = "./templates/static";
  const staticSites = await fs.readdirSync(staticDir);
  for (const site of staticSites) {
    await fs.writeFileSync(
      path.join(config.serverConfigDir, `${site.slice(0, -4)}.conf`),
      await ejs.renderFile(path.join(staticDir, site), {})
    );
  }
}
