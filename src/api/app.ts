import express, {
  ErrorRequestHandler,
  Request,
  Response,
  Express,
} from "express";
import morgan from "morgan";
import { HttpError, BadRequestError, asyncHandler } from "./utils/asyncHandler";
import { entriesDb } from "./db";
import { reconfigureNGINX } from "./utils/nginx";
import { sanitizeExternal, sanitizeFrom, sanitizeTo } from "./utils/sanitize";
import { config } from "../config";

function getHttpsApi(dappnodeDomain: string): Express {
  const app = express();

  app.use(morgan("tiny"));

  app.get(
    "/add",
    asyncHandler(async (req) => {
      const from = await sanitizeFrom(req.query.from as string);
      const to = sanitizeTo(req.query.to as string);
      const external = sanitizeExternal(req.query.external as string); //true if not set, we should swap this, but it left like this for backwards compatibility

      const entries = entriesDb.read();
      if (entries.some((entry) => entry.from === from)) {
        throw new BadRequestError("External endpoint already exists");
      }

      // NGINX will crash in loop if a domain is longer than `server_names_hash_bucket_size`
      // Force that from has only ASCII characters to make sure the char length = bytes lenght
      // fulldomain = from + "." + dappnodeDomain
      const maxLen = config.maximum_domain_length - dappnodeDomain.length - 1;
      if (from.length > maxLen) {
        throw new BadRequestError(
          `'from' ${from} exceeds max length of ${from}`
        );
      }

      entries.push({ from, to, external });
      entriesDb.write(entries);

      const reconfigured = await reconfigureNGINX(dappnodeDomain);
      if (!reconfigured) {
        entriesDb.write(entries.filter((e) => e.from !== from)); // rollback
        await reconfigureNGINX(dappnodeDomain);
        throw new HttpError("Unable to add mapping", 500);
      }
    })
  );

  app.get(
    "/remove",
    asyncHandler(async (req) => {
      const from = await sanitizeFrom(req.query.from as string);

      const entries = entriesDb.read();
      entriesDb.write(entries.filter((e) => e.from !== from));

      await reconfigureNGINX(dappnodeDomain);
    })
  );

  app.get(
    "/",
    asyncHandler(async () => entriesDb.read())
  );

  app.get(
    "/reconfig",
    asyncHandler(async () => await reconfigureNGINX(dappnodeDomain))
  );

  app.get(
    "/clear",
    asyncHandler(async () => {
      entriesDb.write([]);
      await reconfigureNGINX(dappnodeDomain);
    })
  );

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  // Default error handler
  app.use(function (err, _req, res, next) {
    if (res.headersSent) return next(err);
    const code = err instanceof HttpError ? err.code : 500;
    res.status(code).json({ error: err.message });
  } as ErrorRequestHandler);

  return app;
}

export { getHttpsApi };
