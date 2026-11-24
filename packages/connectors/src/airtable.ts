import type { Connector, ConnectorTool } from "./types.js";

const idSchema = (prefix: string) => ({
  type: "string",
  pattern: "^" + prefix + "[A-Za-z0-9]+$",
});
const baseId = idSchema("app");
const tableId = idSchema("tbl");
const recordId = idSchema("rec");
const offset = { type: "string", minLength: 1 };
const fields = { type: "object", minProperties: 1 };

function tool(
  name: string,
  description: string,
  access: ConnectorTool["access"],
  properties: Record<string, unknown>,
  required: string[],
): ConnectorTool {
  return {
    name,
    description,
    access,
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

const tools = [
  tool("list_bases", "List accessible bases", "read", { offset }, []),
  tool("get_schema", "List tables and fields", "read", { baseId }, ["baseId"]),
  tool(
    "list_records",
    "List one page of records",
    "read",
    { baseId, tableId, offset },
    ["baseId", "tableId"],
  ),
  tool(
    "create_record",
    "Create a record",
    "write",
    { baseId, tableId, fields },
    ["baseId", "tableId", "fields"],
  ),
  tool(
    "update_record",
    "Update an existing record",
    "write",
    { baseId, tableId, recordId, fields },
    ["baseId", "tableId", "recordId", "fields"],
  ),
];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function identifier(value: unknown, prefix: string): string {
  if (
    typeof value !== "string" ||
    !new RegExp("^" + prefix + "[A-Za-z0-9]+$").test(value)
  ) {
    throw new Error("Invalid Airtable identifier.");
  }
  return value;
}

/** Native Airtable connector. Credentials are resolved server-side. */
export function createAirtableConnector(
  request: typeof fetch = fetch,
): Connector {
  return {
    manifest: {
      id: "airtable",
      name: "Airtable",
      description: "Discover tables and read or write records.",
      version: "0.1.0",
      authentication: "token",
    },
    async connect(context) {
      const token = await context.getSecret("accessToken");
      if (!token || !token.trim()) {
        throw new Error("Airtable access token is required.");
      }
      const allowWrites = context.configuration.allowWrites === true;
      const available = tools.filter(
        (item) => item.access === "read" || allowWrites,
      );
      const controller = new AbortController();
      return {
        async listTools() {
          return structuredClone(available);
        },
        async callTool(name, input) {
          if (controller.signal.aborted) {
            throw new Error("Airtable session is closed.");
          }
          const definition = available.find((item) => item.name === name);
          if (!definition) throw new Error("Airtable tool is unavailable.");
          const data = object(input);
          const properties = object(definition.inputSchema.properties);
          if (Object.keys(data).some((key) => !Object.hasOwn(properties, key))) {
            throw new Error("Unknown Airtable tool parameter.");
          }
          let path = "meta/bases";
          let method = "GET";
          let body: string | undefined;
          if (name !== "list_bases") {
            const base = identifier(data.baseId, "app");
            if (name === "get_schema") {
              path = "meta/bases/" + base + "/tables";
            } else {
              path = base + "/" + identifier(data.tableId, "tbl");
            }
          }
          if (name === "create_record" || name === "update_record") {
            const values = object(data.fields);
            if (!Object.keys(values).length) {
              throw new Error("At least one field is required.");
            }
            method = name === "create_record" ? "POST" : "PATCH";
            if (name === "update_record") {
              path += "/" + identifier(data.recordId, "rec");
            }
            body = JSON.stringify({ fields: values });
          }
          const url = new URL("https://api.airtable.com/v0/" + path);
          if (name === "list_records") {
            url.searchParams.set("pageSize", "100");
            url.searchParams.set("returnFieldsByFieldId", "true");
          }
          if (data.offset !== undefined) {
            if (typeof data.offset !== "string" || !data.offset) {
              throw new Error("Invalid Airtable page offset.");
            }
            url.searchParams.set("offset", data.offset);
          }
          let response: Response;
          try {
            response = await request(url, {
              method,
              headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
              },
              body,
              redirect: "error",
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(15000),
              ]),
            });
          } catch {
            throw new Error("Airtable request failed.");
          }
          if (!response.ok) {
            throw new Error(
              "Airtable request failed (HTTP " + response.status + ").",
            );
          }
          return response.json() as Promise<unknown>;
        },
        async close() {
          controller.abort();
        },
      };
    },
  };
}
