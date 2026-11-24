# Connectors

AI-independent, server-side connector contracts for trusted native integrations
and future MCP transports. No model, API key, or AI subscription is required.

Register a connector with `createConnectorRegistry()`, open a session with a
profile-scoped context, discover tools with `listTools()`, invoke a declared
tool with `callTool(name, input)`, and close the session in a finally block.

The registry is not an authorization boundary. The host must authenticate the
caller, authorize profile and connection access, validate tool inputs against
their schemas, enforce read/write permissions, and provide a scoped secret
resolver. Connectors must not expose credentials in tool output or metadata.

This package does not yet implement persistent connections, OAuth or synchronization. Those belong in subsequent changes.

## Airtable

Register `createAirtableConnector()` with the registry. Provide a personal
access token through the context secret resolver under `accessToken`. Grant
`schema.bases:read` and `data.records:read` on the intended bases. For writes,
also grant `data.records:write` and set `configuration.allowWrites` to true.
The host must authorize that setting; never accept it directly from an
untrusted caller. The adapter returns one page at a time with the Airtable
pagination offset. HTTP 429 is reported to the caller for retry scheduling;
record writes are never retried automatically. No record deletion is exposed.

## Remote MCP

Register `createMcpConnector({ manifest, endpoint, tools })` with an explicit
host-approved HTTPS endpoint and a tool-name to read/write access map.
Never derive endpoint or permissions from untrusted requests. The deployment
must enforce outbound network restrictions, including private network access.
Token authentication uses the scoped `accessToken` secret; writes additionally
require `configuration.allowWrites`. The adapter uses the stateless 2026-07-28
protocol with JSON responses only. SSE, older session-based servers, OAuth,
stdio and interactive input requests are not supported by this initial adapter.
No AI or model credentials are needed.

The MCP adapter supports `protocol: "modern"` (default), `"legacy"`, or `"auto"`. Auto probes `server/discover` and falls back only for explicit unsupported-method/version errors. Legacy Streamable HTTP negotiates 2025-11-25, 2025-06-18 or 2025-03-26, carries session headers and attempts session cleanup. Both modes accept bounded JSON or request-scoped SSE responses. Tool execution is never automatically retried across protocols. Server-initiated requests, reconnect/resume and OAuth are not supported.
