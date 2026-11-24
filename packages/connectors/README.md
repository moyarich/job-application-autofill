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

This package does not yet implement persistent connections, OAuth, MCP
transport, Airtable, or synchronization. Those belong in subsequent changes.
