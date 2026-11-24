import { McpToolRunner } from "./McpToolRunner";
import { AirtableMapping } from "./AirtableMapping";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import { WorkspaceHeader } from "../../components/WorkspaceHeader/WorkspaceHeader";
import { useProfileSelection } from "../../hooks/useProfileSelection";
import {
  connectionRequest,
  type Connection,
  type ConnectionTool,
  type ConnectorManifest,
} from "../../api/connections";
import "./PageConnections.css";

type Inspection = {
  id: string;
  tools: ConnectionTool[];
  message: string;
};

function Connections({ profileId }: { profileId: string }) {
  const [connectors, setConnectors] = useState<ConnectorManifest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectorId, setConnectorId] = useState("airtable");
  const [name, setName] = useState("");
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [endpoint, setEndpoint] = useState("");
  const [authentication, setAuthentication] = useState<"none" | "token" | "oauth2">("token");
  const [oauthEndpoints, setOauthEndpoints] = useState<string[]>([]);
  const [oauthFlow, setOauthFlow] = useState<{ authorizationUrl: string; flowId: string } | null>(null);
  const [discovered, setDiscovered] = useState<Omit<ConnectionTool, "access">[] | null>(null);
  const [permissions, setPermissions] = useState<Record<string, "read" | "write">>({});
  const [allowWrites, setAllowWrites] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const token = useRef<HTMLInputElement>(null);
  const requestScope = useRef<AbortController | null>(null);

  useEffect(() => {
    const scope = new AbortController();
    requestScope.current = scope;
    void Promise.all([
      connectionRequest<ConnectorManifest[]>(
        profileId,
        "connectors",
        "GET",
        undefined,
        scope.signal,
      ),
      connectionRequest<Connection[]>(
        profileId,
        "connections",
        "GET",
        undefined,
        scope.signal,
      ),
      connectionRequest<string[]>(profileId, "connectors/mcp-endpoints", "GET", undefined, scope.signal),
      connectionRequest<string[]>(profileId, "connectors/mcp-oauth", "GET", undefined, scope.signal),
    ])
      .then(([available, saved, approved, oauthAvailable]) => {
        if (scope.signal.aborted) return;
        setConnectors(available);
        setEndpoints(approved);
        setOauthEndpoints(oauthAvailable);
        setEndpoint(approved[0] ?? "");
        setConnections(saved);
        setConnectorId(available[0]?.id ?? "");
      })
      .catch(() => {
        if (!scope.signal.aborted) setError("Could not load connections.");
      })
      .finally(() => {
        if (!scope.signal.aborted) setBusy(false);
      });
    return () => scope.abort();
  }, [profileId]);

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    const signal = requestScope.current?.signal;
    if (!signal || signal.aborted || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action(signal);
    } catch (failure) {
      if (!signal.aborted)
        setError(failure instanceof Error ? failure.message : "Connection failed.");
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  function resetDiscovery() {
    setDiscovered(null);
    setPermissions({});
  }

  function beginOAuth() {
    setOauthFlow(null);
    resetDiscovery();
    void run(async (signal) => {
      const result = await connectionRequest<{ authorizationUrl: string; flowId: string }>(profileId, "connectors/mcp-oauth", "POST", { endpoint }, signal);
      if (!signal.aborted) setOauthFlow(result);
    });
  }

  function discover() {
    const accessToken = authentication === "token" ? token.current?.value ?? "" : "";
    if (authentication === "token" && !accessToken) {
      setError("Enter a bearer token first.");
      return;
    }
    resetDiscovery();
    void run(async (signal) => {
      const tools = await connectionRequest<Omit<ConnectionTool, "access">[]>(
        profileId, "connectors/mcp-discover", "POST",
        { endpoint, authentication, accessToken, ...(authentication === "oauth2" ? { flowId: oauthFlow?.flowId } : {}) }, signal,
      );
      if (!signal.aborted) setDiscovered(tools);
    });
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const isMcp = connectorId === "mcp";
    const needsToken = !isMcp || authentication === "token";
    const accessToken = needsToken ? token.current?.value ?? "" : "";
    if (needsToken && !accessToken) return;
    if (token.current) token.current.value = "";
    const tools = Object.fromEntries(Object.entries(permissions).filter(([, access]) => access === "read" || allowWrites));
    if (isMcp && (!discovered || !Object.keys(tools).length)) return;
    void run(async (signal) => {
      const saved = await connectionRequest<Connection>(
        profileId,
        "connections",
        "POST",
        { connectorId, name, accessToken, allowWrites, ...(isMcp ? { endpoint, authentication, tools, ...(authentication === "oauth2" ? { flowId: oauthFlow?.flowId } : {}) } : {}) },
        signal,
      );
      if (signal.aborted) return;
      setConnections((current) => [...current, saved]);
      setShowForm(false);
      setOauthFlow(null);
      resetDiscovery();
      setName("");
      setAllowWrites(false);
      setNotice("Connection saved. Test it to verify credentials.");
    });
  }

  function inspect(connection: Connection, test: boolean) {
    void run(async (signal) => {
      const path = "connections/" + encodeURIComponent(connection.id) + "/tools";
      setInspection(null);
      const tools = await connectionRequest<ConnectionTool[]>(
        profileId,
        path,
        "GET",
        undefined,
        signal,
      );
      if (test && connection.connectorId === "airtable") {
        if (
          connection.connectorId !== "airtable" ||
          !tools.some((tool) => tool.name === "list_bases" && tool.access === "read")
        ) {
          throw new Error("No supported read-only connection test.");
        }
        await connectionRequest<unknown>(
          profileId,
          path + "/list_bases",
          "POST",
          {},
          signal,
        );
      }
      if (!signal.aborted) {
        setInspection({
          id: connection.id,
          tools,
          message: connection.connectorId === "mcp" ? "MCP tool discovery completed. Only approved tools are shown." : test
            ? "Airtable accepted the credentials."
            : "Available tools (credentials not remotely verified).",
        });
      }
    });
  }

  function remove(connection: Connection) {
    void run(async (signal) => {
      await connectionRequest(
        profileId,
        "connections/" + encodeURIComponent(connection.id),
        "DELETE",
        undefined,
        signal,
      );
      if (signal.aborted) return;
      setConnections((current) =>
        current.filter((item) => item.id !== connection.id),
      );
      setInspection((current) =>
        current?.id === connection.id ? null : current,
      );
      setRemoveId(null);
      setNotice("Local connection removed. External records were not changed.");
    });
  }

  const selected = connectors.find((item) => item.id === connectorId);

  return (
    <div className="connections-page">
      <section className="panel connections-panel">
        <div className="connections-heading">
          <h2>Available connections</h2>
          <button
            type="button"
            disabled={busy || !connectors.length}
            onClick={() => setShowForm((current) => !current)}
          >
            <Plus size={16} aria-hidden="true" /> Add connection
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {busy && <p role="status">Working…</p>}
        {showForm && (
          <form className="connections-form" onSubmit={add}>
            <label>
              Service
              <select
                value={connectorId}
                onChange={(event) => { setConnectorId(event.target.value); resetDiscovery(); }}
                disabled={busy}
              >
                {connectors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Connection name
              <input
                required
                maxLength={120}
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {connectorId === "mcp" && <>
              <label>Approved MCP endpoint
                <select disabled={busy} value={endpoint} onChange={(event) => { setEndpoint(event.target.value); setAuthentication("token"); setOauthFlow(null); resetDiscovery(); if (token.current) token.current.value = ""; }}>
                  {endpoints.map((url) => <option key={url} value={url}>{url}</option>)}
                </select>
              </label>
              <label>Authentication
                <select disabled={busy} value={authentication} onChange={(event) => { setAuthentication(event.target.value === "oauth2" ? "oauth2" : event.target.value === "none" ? "none" : "token"); setOauthFlow(null); resetDiscovery(); }}>
                  <option value="token">Bearer token</option>
                  <option value="none">None</option>
                  {oauthEndpoints.includes(endpoint) && <option value="oauth2">OAuth 2.1</option>}
                </select>
              </label>

              <p>Only approve known tools from a trusted server. Read/write labels are your classification, not a guarantee of server behavior.</p>
            </>}
            {(connectorId !== "mcp" || authentication === "token") && <label>
              {connectorId === "mcp" ? "Bearer token" : "Personal access token"}
              <input
                ref={token}
                onChange={resetDiscovery}
                type="password"
                required
                maxLength={4096}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
            </label>}
            {connectorId === "airtable" && (
              <p>
                Create an Airtable personal access token with access to the
                intended bases and schema.bases:read and data.records:read
                scopes. Writes also require data.records:write.
              </p>
            )}
            <label className="connections-checkbox">
              <input
                type="checkbox"
                checked={allowWrites}
                disabled={busy}
                onChange={(event) => setAllowWrites(event.target.checked)}
              />
              Allow external record creation and updates
            </label>
            {connectorId === "mcp" && <>
              {authentication === "oauth2" && <>
                <button type="button" disabled={busy || !endpoint} onClick={beginOAuth}>Prepare authorization</button>
                {oauthFlow && <p><a href={oauthFlow.authorizationUrl} target="_blank" rel="noopener noreferrer">Authorize in a new tab</a>, then return here and discover tools.</p>}
              </>}
              <button type="button" disabled={busy || !endpoint || (authentication === "oauth2" && !oauthFlow)} onClick={discover}>Discover tools</button>
              {discovered && <fieldset disabled={busy} className="connections-form">
                <legend>Approve discovered tools</legend>
                {discovered.length === 0 && <p>No supported tools discovered.</p>}
                {discovered.map((tool) => (
                  <div key={tool.name}>
                    <label>{tool.name}
                      <select value={Object.hasOwn(permissions, tool.name) ? permissions[tool.name] : ""} onChange={(event) => {
                        const access = event.target.value;
                        setPermissions((current) => {
                          const next = { ...current };
                          if (access === "read" || access === "write") Object.defineProperty(next, tool.name, { value: access, enumerable: true, writable: true, configurable: true });
                          else delete next[tool.name];
                          return next;
                        });
                      }}>
                        <option value="">Not approved</option>
                        <option value="read">Read</option>
                        <option value="write" disabled={!allowWrites}>Write</option>
                      </select>
                    </label>
                    <p>{tool.description}</p>
                    <details><summary>Input schema</summary><pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre></details>
                  </div>
                ))}
              </fieldset>}
            </>}
            <p>
              Configure MOYA_CONNECTOR_KEY on the server before saving.
              Tokens are not returned to the dashboard.
            </p>
            <div className="actions">
              <button
                type="submit"
                disabled={busy || !selected || (connectorId === "mcp" && (!endpoint || !discovered || !Object.values(permissions).some((access) => access === "read" || allowWrites)))}
              >
                Save connection
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowForm(false);
                  resetDiscovery();
                  setName("");
                  setAllowWrites(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {!busy && !connections.length && <p>No saved connections.</p>}
        {connections.map((connection) => (
          <article className="connection-item" key={connection.id}>
            <div className="connections-heading">
              <div className="connection-identity">
                <Plug size={22} aria-hidden="true" />
                <div>
                  <h3>{connection.name}</h3>
                  <p>
                    {connectors.find((item) => item.id === connection.connectorId)
                      ?.name ?? connection.connectorId}{" "}
                    · {connection.allowWrites ? "Read and write" : "Read only"}
                  </p>
                </div>
              </div>
              <div className="actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inspect(connection, true)}
                >
                  <RefreshCw size={16} aria-hidden="true" /> Test connection
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inspect(connection, false)}
                >
                  View tools
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoveId(connection.id)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Disconnect
                </button>
              </div>
            </div>
            {connection.connectorId === "airtable" && (
              <AirtableMapping profileId={profileId} connection={connection} />
            )}
            {removeId === connection.id && (
              <div className="connections-confirm">
                <p>Remove this local connection and its stored token?</p>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(connection)}
                  >
                    Confirm disconnect
                  </button>
                  <button type="button" onClick={() => setRemoveId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {inspection?.id === connection.id && (
              <div className="connection-inspection">
                <p role="status">{inspection.message}</p>
                <ul>
                  {inspection.tools.map((tool) => (
                    <li key={tool.name}>
                      <strong>{tool.name}</strong> · {tool.access}
                      <p>{tool.description}</p>
                      {connection.connectorId === "mcp" && <McpToolRunner profileId={profileId} connectionId={connection.id} tool={tool} disabled={busy} />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

export function PageConnections() {
  const selection = useProfileSelection();
  return (
    <>
      <WorkspaceHeader
        title="Connections"
        description="Connect external services to your local profile."
      />
      {selection.message && <p role="alert">{selection.message}</p>}
      {selection.hydrated && (
        <Connections
          key={selection.activeProfileId}
          profileId={selection.activeProfileId}
        />
      )}
    </>
  );
}
