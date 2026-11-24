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

The backend registers native Airtable and supports profile-owned custom MCP connections. The administrator must configure exact trusted HTTPS endpoints in MOYA_MCP_ENDPOINTS. Users choose an approved endpoint, bearer token, OAuth, or no authentication, discover tools in a non-executable session, and explicitly assign read/write permissions before saving. Discovery credentials are not persisted until the connection is saved. Generic execution generates forms for flat object schemas with primitive fields and enums. Optional fields are omitted unless included; unsupported schemas and additional arguments use the JSON editor. Both modes require confirmation and server-side schema validation. The dashboard uses only the stateless MCP 2026-07-28 protocol, without initialization handshakes, negotiated versions or remote session identifiers. JSON and request-scoped SSE responses are supported; Server-initiated requests, stream resumption and arbitrary endpoints are not supported. Profile headers select local data and are not authentication. Do not expose this local API publicly.

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

## OAuth configuration

OAuth uses only Authorization Code + S256 PKCE, issuer verification, and a public Client ID Metadata Document (CIMD). Configure an exact trusted resource, issuer, metadata URLs, authorization and token endpoints, client metadata URL, and minimal scopes via the JSON array in `MOYA_MCP_OAUTH_CONFIG`. The resource must also appear in `MOYA_MCP_ENDPOINTS`. Each object uses keys `endpoint`, `issuer`, `resourceMetadata`, `authorizationMetadata`, `authorizationEndpoint`, `tokenEndpoint`, `clientId`, and `scopes` (array of strings). The client metadata must publish the exact local dashboard callback URL, e.g. `http://localhost:5173/api/connectors/mcp-oauth/callback`, and declare public client authentication (`none`). No dynamic client registration or implicit grant is supported. Metadata must match the administrator's exact approved URLs; arbitrary metadata-derived destinations are not contacted. OAuth state and unsaved grants expire after ten minutes and are lost on API restart. Saved access/refresh tokens are encrypted in SQLite. Refresh happens before expiry, not by replaying a failed tool call. Disconnect locally or revoke at the authorization provider.

## Generic MCP application workflows

Writable MCP connections can save a manual export mapping from application fields to declared write-tool arguments, with optional fixed JSON parameters. Preview validates the arguments and produces a review token; execution rechecks the current application, tool schema and mapping before calling the tool. Only mapped fields are sent. Generic tools do not guarantee idempotency or record identity: no automatic imports, deduplication, bidirectional sync or scheduling is implied. Do not put secrets in constant arguments.
