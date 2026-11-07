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

Each table is defined independently in `src/database/tables/` and initialized
in foreign-key dependency order by `src/database/schema.ts`. Resumes have
per-resume revisions; applications have per-application revisions. There is
no shared `profile_state`, schema versioning, or backward compatibility.

Import persistence from `src/database/store.ts` directly.
