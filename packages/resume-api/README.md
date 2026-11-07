# Resume API

This package has four boundaries:

- `src/api/`: HTTP endpoint handlers returning normalized responses.
- `src/services/`: application preparation and resume processing.
- `src/database/`: SQLite connection, versioned `.sql` migrations, and domain query repositories.
- `src/server/`: transport-neutral request/response contract and a replaceable Node adapter.

The executable `index.ts` is intentionally thin. No domain route imports
`node:http`. Preserve response codes, headers and profile ownership checks
when swapping transports.

## Switching to Express

The shared API handler does **not** require Express. An Express integration
can replace `src/server/node.ts` with the following adapter (install Express
and its TypeScript types first):

```ts
import express from "express";
import { createApiHandler } from "./src/server/app.ts";
import { openStore } from "./src/database/store.ts";

const app = express();
const handler = createApiHandler(openStore(), {
  origin: process.env.AUTOFILL_ORIGIN || "http://localhost:5173",
});

app.use(express.json({ limit: "15mb" }));
app.use(async (req, res) => {
  const result = await handler({
    method: req.method,
    url: new URL(req.originalUrl, "http://localhost"),
    headers: req.headers,
    readJson: async () => req.body,
  });
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.status(result.status).type(result.contentType || "application/json");
  if (result.contentType) res.send(result.body);
  else res.json(result.body);
});
```

Express is not required by the package; the native Node adapter stays the default.

## SQLite schema and upgrades

`src/database/migrations/*.sql` is the only schema source. `migrations.ts`
tracks applied migrations in `schema_migrations` and adopts existing databases,
including databases already containing `profile_contact.extra_json`.
Never edit an applied migration; add another numbered SQL file and register it
in the runner. There is no duplicate `schema.sql` file.

Import persistence from `src/database/store.ts` directly. No compatibility entry point is provided.
