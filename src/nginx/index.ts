import ejs from "ejs";
import { DomainMapping } from "../types";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { ensureValidCert } from "../certificates";
import generateNginxConf, {
  generateServerConfig,
  generateStaticServers,
} from "./templater";

async function deleteOldConfig(mappings: DomainMapping[]): Promise<void> {
  const dirContent = await fs.readdirSync(config.serverConfigDir);
  const allowedFiles = mappings.map((m) => `${m.from}.ssl.conf`);
  const filesToDelete = dirContent.filter(
    (x) => x.endsWith(".ssl.conf") && !allowedFiles.includes(x)
  );
  await Promise.all(
    filesToDelete.map((filename) =>
      fs.rmSync(path.join(config.serverConfigDir, filename))
    )
  );
}

export async function updateServerConfigs(
  mappings: DomainMapping[],
  force: boolean
) {
  console.log(" *** Updating mappings *** ");
  await deleteOldConfig(mappings);

  const dirContent = await fs.readdirSync(config.serverConfigDir);
  var checkedCert = false;
  for (const mapping of mappings) {
    const filename = `${mapping.from}.ssl.conf`;
    if (dirContent.find((x) => x === filename) !== undefined && !force)
      continue;
    console.log(` *-> Adding ${mapping.from} mapping <-*`);
    if (!checkedCert) {
      await ensureValidCert(true);
      checkedCert = true;
    }
    await fs.writeFileSync(
      path.join(config.serverConfigDir, filename),
      await generateServerConfig(mapping)
    );
  }
}

export default async function prepareNGINX() {
  console.log("Generating NGINX configuration");
  console.log("- Generating nginx.conf");
  await generateNginxConf();

  console.log("- Generating static pages");
  await generateStaticServers();
}
