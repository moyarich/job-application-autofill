import { useState } from "react";
import { connectionRequest, type ConnectionTool } from "../../api/connections";

export function McpToolRunner({ profileId, connectionId, tool, disabled }: {
  profileId: string;
  connectionId: string;
  tool: ConnectionTool;
  disabled: boolean;
}) {
  const [input, setInput] = useState("{}");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  async function execute() {
    if (disabled || busy || !confirmed) return;
    setConfirmed(false);
    setBusy(true);
    setOutput("");
    setError("");
    try {
      const args: unknown = JSON.parse(input);
      if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Expected object");
      const result = await connectionRequest<unknown>(profileId, "connections/" + encodeURIComponent(connectionId) + "/tools/" + encodeURIComponent(tool.name), "POST", args);
      setOutput(JSON.stringify(result, null, 2) ?? "");
    } catch {
      setError("Tool execution failed or could not be confirmed. Check arguments and permissions before retrying.");
    } finally {
      setBusy(false);
    }
  }
  return <details>
    <summary>Run tool</summary>
    <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
    <label>JSON arguments<textarea disabled={busy || disabled} value={input} onChange={(event) => { setInput(event.target.value); setConfirmed(false); }} /></label>
    <label><input type="checkbox" checked={confirmed} disabled={busy || disabled} onChange={(event) => setConfirmed(event.target.checked)} /> I approve sending these arguments to the remote tool.</label>
    <button type="button" disabled={busy || disabled || !confirmed} onClick={() => void execute()}>Execute {tool.name}</button>
    {error && <p role="alert">{error}</p>}
    {output && <pre>{output}</pre>}
  </details>;
}
