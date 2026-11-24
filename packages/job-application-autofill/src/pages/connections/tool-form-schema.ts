export type FieldKind = "string" | "number" | "integer" | "boolean" | "enum";
export type ToolField = {
  name: string;
  title: string;
  description: string;
  required: boolean;
  kind: FieldKind;
  choices?: (string | number | boolean | null)[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
};
export type ToolDraft = Record<string, string>;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const rootKeywords = new Set(["type", "properties", "required", "additionalProperties", "title", "description", "$schema"]);
const fieldKeywords = new Set(["type", "title", "description", "enum", "default", "examples", "minimum", "maximum", "minLength", "maxLength"]);
const primitive = (value: unknown): value is string | number | boolean | null =>
  value === null || typeof value === "string" || typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value));

/** Only generate a form for a deliberately small, lossless subset. */
export function describeToolForm(schema: unknown): ToolField[] | null {
  if (!record(schema) || schema.type !== "object" ||
    Object.keys(schema).some((key) => !rootKeywords.has(key)) ||
    (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== "boolean") ||
    (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some((name) => typeof name !== "string"))) ||
    (schema.properties !== undefined && !record(schema.properties))) return null;
  const properties = (schema.properties ?? {}) as Record<string, unknown>;
  const required = new Set((schema.required ?? []) as string[]);
  if ([...required].some((name) => !Object.hasOwn(properties, name)) || Object.keys(properties).length > 50) return null;
  const fields: ToolField[] = [];
  for (const [name, value] of Object.entries(properties)) {
    if (!record(value) || Object.keys(value).some((key) => !fieldKeywords.has(key))) return null;
    const kind = value.type;
    if (kind !== "string" && kind !== "number" && kind !== "integer" && kind !== "boolean") return null;
    if (value.enum !== undefined && (!Array.isArray(value.enum) || !value.enum.length || value.enum.length > 100 ||
      !value.enum.every(primitive) || !value.enum.every((item) =>
        kind === "integer" ? typeof item === "number" && Number.isInteger(item) : typeof item === kind))) return null;
    if (["minimum", "maximum", "minLength", "maxLength"].some((key) => value[key] !== undefined &&
      (typeof value[key] !== "number" || !Number.isFinite(value[key])))) return null;
    if ((value.minimum !== undefined || value.maximum !== undefined) && kind !== "number" && kind !== "integer") return null;
    if ((value.minLength !== undefined || value.maxLength !== undefined) && kind !== "string") return null;
    if ([value.minLength, value.maxLength].some((n) => n !== undefined && (!Number.isInteger(n) || Number(n) < 0))) return null;
    fields.push({
      name,
      title: typeof value.title === "string" ? value.title : name,
      description: typeof value.description === "string" ? value.description : "",
      required: required.has(name),
      kind: value.enum ? "enum" : kind,
      choices: value.enum as ToolField["choices"],
      min: value.minimum as number | undefined,
      max: value.maximum as number | undefined,
      minLength: value.minLength as number | undefined,
      maxLength: value.maxLength as number | undefined,
    });
  }
  return fields;
}

/** Missing keys are omitted, including optional empty values not explicitly included. */
export function buildToolArguments(fields: ToolField[], draft: ToolDraft): Record<string, unknown> {
  const entries: [string, unknown][] = [];
  for (const field of fields) {
    if (!Object.hasOwn(draft, field.name)) {
      if (field.required) throw new Error("Complete required field: " + field.title);
      continue;
    }
    const raw = draft[field.name];
    let value: unknown = raw;
    if (field.kind === "enum") {
      const index = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(index) || !field.choices || index >= field.choices.length)
        throw new Error("Choose a value for " + field.title);
      value = field.choices[index];
    } else if (field.kind === "boolean") {
      if (raw !== "true" && raw !== "false") throw new Error("Choose a value for " + field.title);
      value = raw === "true";
    } else if (field.kind === "number" || field.kind === "integer") {
      value = Number(raw);
      if (!raw.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(value) ||
        (field.kind === "integer" && !Number.isSafeInteger(value)))
        throw new Error("Enter a valid " + field.kind + " for " + field.title);
    }
    if (typeof value === "number" && ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)))
      throw new Error("Number outside allowed range: " + field.title);
    if (typeof value === "string" && ((field.minLength !== undefined && [...value].length < field.minLength) || (field.maxLength !== undefined && [...value].length > field.maxLength)))
      throw new Error("Text outside allowed length: " + field.title);
    entries.push([field.name, value]);
  }
  return Object.fromEntries(entries);
}
