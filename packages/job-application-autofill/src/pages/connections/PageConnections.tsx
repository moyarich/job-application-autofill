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
    ])
      .then(([available, saved]) => {
        if (scope.signal.aborted) return;
        setConnectors(available);
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

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token.current?.value) return;
    const accessToken = token.current.value;
    token.current.value = "";
    void run(async (signal) => {
      const saved = await connectionRequest<Connection>(
        profileId,
        "connections",
        "POST",
        { connectorId, name, accessToken, allowWrites },
        signal,
      );
      if (signal.aborted) return;
      setConnections((current) => [...current, saved]);
      setShowForm(false);
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
      if (test) {
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
          message: test
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
                onChange={(event) => setConnectorId(event.target.value)}
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
            <label>
              Personal access token
              <input
                ref={token}
                type="password"
                required
                maxLength={4096}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
            </label>
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
            <p>
              Configure MOYA_CONNECTOR_KEY on the server before saving.
              Tokens are not returned to the dashboard.
            </p>
            <div className="actions">
              <button
                type="submit"
                disabled={busy || selected?.authentication !== "token"}
              >
                Save connection
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowForm(false);
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
