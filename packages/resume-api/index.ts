import { basename, dirname, resolve } from "node:path";
import { openStore } from "./src/database/store.ts";
import { createApiHandler } from "./src/server/app.ts";
import { createNodeServer } from "./src/server/node.ts";

// Local development loads .env; container builds supply environment variables.
try {
  process.loadEnvFile(
    resolve(
      basename(import.meta.dirname) === "dist"
        ? dirname(import.meta.dirname)
        : import.meta.dirname,
      "../../.env",
    ),
  );
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
    throw error;
}
const port = Number(process.env.AUTOFILL_PORT || 4177);
const host = process.env.AUTOFILL_HOST || "127.0.0.1";
const handler = createApiHandler(openStore(), {
  origin: process.env.AUTOFILL_ORIGIN || "http://localhost:5173",
});
createNodeServer(handler).listen(port, host, () =>
  console.log(
    "job-application-autofill local API listening on " + host + ":" + port,
  ),
);
