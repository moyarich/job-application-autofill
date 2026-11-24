# Connector integration

The local API owns credentials, profile-scoped records and synchronization. No model is involved.

| Layer | Location |
| --- | --- |
| Connector interface and registry | `packages/connectors/src` |
| Native Airtable and optional remote MCP adapters | `packages/connectors/src` |
| Credential storage and tool authorization | `packages/resume-api/src/database/repositories/connections.ts` |
| Mapping, links, review and transfers | `packages/resume-api/src/database/repositories/application-sync.ts` |
| HTTP routes | `packages/resume-api/src/api/connections.ts` |
| Dashboard | `packages/job-application-autofill/src/pages/connections` |

## Data and access

The backend registers Airtable only. The MCP adapter is a library building block for trusted statically configured HTTPS servers, not a general user-installable plugin system. Profile headers select local data and are not authentication. Do not expose this local API publicly.

The token is encrypted with AES-256-GCM using a separate 32-byte key and authenticated connection/profile identity. The key comes from `MOYA_CONNECTOR_KEY` and must be 64 hexadecimal characters. Tool inputs are checked against registered schemas. External writes require explicit opt-in.

## Sync rules

Initial imports and exports create records only. A successful creation stores a stable external record ID and hashes of mapped values. Later reviews compare each side with its baseline. Sync propagates only one-sided changes from a matching baseline, or acknowledges identical converged changes. Conflicts, missing records and divergent baselines require review. Explicit resolutions re-read the record and use a review token plus local revision checks. Airtable does not provide an atomic compare-and-swap guarantee in this implementation.

Scheduled sync is opt-in, operates on linked records, checks once a minute and runs only in the API process. It pauses on failure. The implementation assumes one API process. History includes the most recent 50 aggregate and individual runs. No automatic record deletion or automatic linking of existing URL matches is provided.

## Validation

From the repository root:

```sh
npm ci
npm run build:js
npx vitest run tests/connectors tests/resume-api
npx playwright test tests/editor/connections.spec.ts
npm run checks
```

Mock tests do not require a real token. For a live smoke test use a disposable Airtable base with synthetic application data; verify read-only discovery first, then opt into writes, export one record, change a mapped field, review and sync. Test a two-sided conflict and disconnect. Do not use production data or credentials in CI.
