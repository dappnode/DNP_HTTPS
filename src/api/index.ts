import { app } from "./app";
import { AddressInfo } from "net";
import { reconfigureNGINX } from "./utils/nginx";
import { entriesDb } from "./db";

function dbMigration() {
  const mappings = entriesDb.read();
  entriesDb.write(
    mappings.map((m) => {
      return {
        ...m,
        external: m.external ?? true,
      };
    })
  );
}

export default async function startAPI() {
  dbMigration();
  await reconfigureNGINX();
  const server = app.listen(5000, "0.0.0.0", () => {
    const { port, address } = server.address() as AddressInfo;
    console.log("Server listening on:", "http://" + address + ":" + port);
  });
}
