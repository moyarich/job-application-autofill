# Resume API

This package has four boundaries:

- `src/api/`: HTTP endpoint handlers returning normalized responses.
- `src/services/`: application preparation and resume processing.
- `src/database/`: SQLite connection, independent table definitions in `tables/`, and domain repositories.
- `src/server/`: transport-neutral request/response contract and a replaceable Node adapter.

The executable `index.ts` is intentionally thin. No domain route imports
`node:http`. Preserve response codes, headers and profile ownership checks
when swapping transports.

## SQLite tables

Each table is defined independently in `src/database/tables/`. `schema.ts`
initializes the version 1 schema in foreign-key dependency order and records
the version using SQLite `user_version`. Version 1 is the complete starting
schema for this new app, not a migration from older structures.

Resumes have per-resume revisions; applications have per-application revisions.
There is no shared `profile_state` table or legacy compatibility layer.
Future schema changes can introduce new versions when needed.

Import persistence from `src/database/store.ts` directly.
