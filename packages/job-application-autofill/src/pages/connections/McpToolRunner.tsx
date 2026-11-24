import { useState } from "react";
import { connectionRequest, type ConnectionTool } from "../../api/connections";
import { buildToolArguments, describeToolForm, type ToolDraft } from "./tool-form-schema";

export function McpToolRunner({ profileId, connectionId, tool, disabled }: {
  profileId: string;
  connectionId: string;
  tool: ConnectionTool;
  disabled: boolean;
}) {
  const fields = describeToolForm(tool.inputSchema);
  const [mode, setMode] = useState<"form" | "json">(fields ? "form" : "json");
  const [draft, setDraft] = useState<ToolDraft>({});
  const [input, setInput] = useState("{}");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const locked = disabled || busy;
  const useForm = mode === "form" && fields !== null;

  function edit(name: string, value: string | undefined) {
    setDraft((current) => {
      const entries = Object.entries(current).filter(([key]) => key !== name);
      if (value !== undefined) entries.push([name, value]);
      return Object.fromEntries(entries);
    });
    setConfirmed(false);
    setError("");
  }

  function switchToJson() {
    try {
      setInput(JSON.stringify(buildToolArguments(fields ?? [], draft), null, 2));
      setError("");
    } catch {
      setInput("{}");
      setError("Incomplete form values were not copied. Enter the arguments in JSON.");
    }
    setMode("json");
    setConfirmed(false);
  }

  async function execute() {
    if (locked || !confirmed) return;
    setConfirmed(false);
    setOutput("");
    setError("");
    let args: unknown;
    try {
      args = useForm ? buildToolArguments(fields, draft) : JSON.parse(input);
      if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be a JSON object.");
    } catch (failure) {
      setError(failure instanceof Error && useForm ? failure.message : "Enter a valid JSON object.");
      return;
    }
    setBusy(true);
    try {
      const result = await connectionRequest<unknown>(profileId, "connections/" + encodeURIComponent(connectionId) + "/tools/" + encodeURIComponent(tool.name), "POST", args);
      setOutput(JSON.stringify(result, null, 2) ?? "");
    } catch {
      setError("Tool execution failed or could not be confirmed. Check arguments and permissions before retrying.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="mcp-tool-runner">
    <summary>Run tool</summary>
    <details><summary>Input schema</summary><pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre></details>
    {fields && <div className="actions">
      <button type="button" disabled={locked || useForm} onClick={() => { setMode("form"); setConfirmed(false); setError(""); }}>Use form</button>
      <button type="button" disabled={locked || !useForm} onClick={switchToJson}>Use JSON</button>
    </div>}
    {useForm ? <fieldset disabled={locked} className="connections-form">
      <legend>Tool arguments</legend>
      {fields.length === 0 && <p>This form has no declared arguments.</p>}
      {fields.map((field) => {
        const included = Object.hasOwn(draft, field.name);
        const value = included ? draft[field.name] : "";
        const choice = field.kind === "enum" || field.kind === "boolean";
        return <div key={field.name} className="mcp-tool-field">
          {!field.required && <label className="connections-checkbox">
            <input type="checkbox" checked={included} onChange={(event) => edit(field.name, event.target.checked ? "" : undefined)} />
            Include {field.title}
          </label>}
          <label>
            {field.title}{field.required ? " (required)" : ""}
            {choice ? <select disabled={!field.required && !included} value={value} onChange={(event) => edit(field.name, event.target.value)}>
              <option value="">Choose a value</option>
              {field.kind === "boolean" ? <><option value="true">True</option><option value="false">False</option></> :
                field.choices?.map((item, index) => <option key={index} value={String(index)}>{typeof item === "string" ? item || "(empty string)" : String(item)}</option>)}
            </select> : <input disabled={!field.required && !included}
              type={field.kind === "number" || field.kind === "integer" ? "number" : "text"}
              step={field.kind === "integer" ? 1 : "any"}
              min={field.min} max={field.max}
              minLength={field.minLength} maxLength={field.maxLength}
              value={value} onChange={(event) => edit(field.name, event.target.value)} />}
          </label>
          {field.description && <p>{field.description}</p>}
        </div>;
      })}
    </fieldset> : <>
      {!fields && <p>This schema requires JSON arguments.</p>}
      <label>JSON arguments<textarea disabled={locked} value={input} onChange={(event) => { setInput(event.target.value); setConfirmed(false); }} /></label>
    </>}
    <label className="connections-checkbox"><input type="checkbox" checked={confirmed} disabled={locked} onChange={(event) => setConfirmed(event.target.checked)} /> I approve sending these arguments to the remote tool.</label>
    <button type="button" disabled={locked || !confirmed} onClick={() => void execute()}>{busy ? "Executing…" : "Execute " + tool.name}</button>
    {error && <p role="alert">{error}</p>}
    {output && <pre>{output}</pre>}
  </details>;
}
