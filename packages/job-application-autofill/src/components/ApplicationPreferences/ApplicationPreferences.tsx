import { getDefaultRegistry } from "@rjsf/core";
import ShadcnForm from "@rjsf/shadcn";
import type {
  ObjectFieldTemplateProps,
  RJSFSchema,
  UiSchema,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import traverse from "json-schema-traverse";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Eye,
  Globe,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { PreferenceInputs } from "./PreferenceInputs";
import { useEffect, useId, useMemo, useState } from "react";
import { FloatingDialog } from "../FloatingDialog/FloatingDialog";
import {
  preferenceFields,
  preferenceRequest,
  type ApplicationPreference,
  type BoardPreferenceSchema,
  type GeneralPreferenceData,
  type PreferenceData,
  type PreferenceSelection,
} from "../../api/application-preferences";
import "./ApplicationPreferences.css";

const { SelectWidget, CheckboxesWidget } = getDefaultRegistry().widgets;
const boardWidgets = { SelectWidget, CheckboxesWidget };

const preferenceSections = [
  {
    title: "Employment eligibility",
    icon: Globe,
    fields: ["country", "workAuthorization", "sponsorship"],
  },
  {
    title: "Salary expectations",
    icon: Banknote,
    fields: [
      "salaryMinimum",
      "salaryMaximum",
      "currency",
      "salaryPeriod",
      "salary",
    ],
  },
  {
    title: "Availability",
    icon: CalendarDays,
    fields: [
      "availabilityType",
      "startDate",
      "noticePeriod",
      "noticeUnit",
      "availability",
    ],
  },
  {
    title: "Work preferences",
    icon: BriefcaseBusiness,
    fields: ["workArrangement", "employmentType", "relocation", "travel"],
  },
];

const groupedFields = new Set(
  preferenceSections.flatMap(({ fields }) => fields),
);

function PreferenceSections({ properties }: ObjectFieldTemplateProps) {
  function renderField({
    name,
    content,
    hidden,
  }: ObjectFieldTemplateProps["properties"][number]) {
    return (
      <div
        className="preference-schema-field"
        data-field={name}
        key={name}
        hidden={hidden}
      >
        {content}
      </div>
    );
  }
  return (
    <div className="preference-schema-sections">
      {preferenceSections.map(({ title, icon: Icon, fields }) => {
        const section = fields.flatMap((name) =>
          properties.filter((property) => property.name === name),
        );
        return (
          section.length > 0 && (
            <fieldset className="preference-schema-section" key={title}>
              <legend>
                <Icon size={17} aria-hidden="true" />
                {title}
              </legend>
              <div className="preference-schema-grid">
                {section.map(renderField)}
              </div>
            </fieldset>
          )
        );
      })}
      {properties
        .filter(({ name }) => !groupedFields.has(name))
        .map(renderField)}
    </div>
  );
}

const boardTemplates = { ObjectFieldTemplate: PreferenceSections };

function boardUiSchema(schema: RJSFSchema): UiSchema {
  const ui: UiSchema = { "ui:submitButtonOptions": { norender: true } };
  traverse(
    schema,
    (node, _pointer, _root, parent, keyword, _parentSchema, key) => {
      if (parent !== "" || keyword !== "properties") return;
      const field = node as RJSFSchema;
      if (field.enum) ui[String(key)] = { "ui:placeholder": "Not specified" };
      if (field.type === "array" && field.uniqueItems)
        ui[String(key)] = { "ui:widget": "checkboxes" };
      if (key === "salary" || key === "availability")
        ui[String(key)] = {
          "ui:widget": "textarea",
          "ui:options": { rows: 2 },
        };
      if (key === "currency") ui.currency = { "ui:placeholder": "USD" };
      if (field.type === "number")
        ui[String(key)] = { "ui:options": { step: "any" } };
    },
  );
  return ui;
}

function PreferenceDetails({
  preference,
  boardSchema,
}: {
  preference: ApplicationPreference;
  boardSchema?: BoardPreferenceSchema;
}) {
  const labels = boardSchema
    ? Object.entries(boardSchema.schema.properties ?? {}).map(
        ([key, field]) => [
          key,
          typeof field === "object" ? (field.title ?? key) : key,
        ],
      )
    : Object.entries(preferenceFields);
  return (
    <dl className="preference-details">
      {labels.map(([key, label]) => {
        const value = preference.data[key];
        return (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {value === 0
                ? 0
                : (Array.isArray(value) ? value.join(", ") : value) ||
                  "Not specified"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PreferenceEditor({
  profileId,
  preference,
  onSaved,
  onClose,
  schemas,
  applicationBoard,
}: {
  profileId: string;
  preference: ApplicationPreference | null;
  onSaved: (saved: ApplicationPreference) => Promise<void>;
  schemas: BoardPreferenceSchema[];
  applicationBoard: string | null | undefined;
  onClose: () => void;
}) {
  const formId = useId();
  const [name, setName] = useState(preference?.name ?? "");
  const [jobBoard, setJobBoard] = useState(
    preference ? preference.jobBoard : (applicationBoard ?? null),
  );
  const boardSchema = schemas.find(
    (entry) => entry.jobBoard === jobBoard,
  )?.schema;
  const uiSchema = useMemo(
    () => boardSchema && boardUiSchema(boardSchema),
    [boardSchema],
  );
  const [drafts, setDrafts] = useState<Record<string, PreferenceData>>({
    [jobBoard ?? ""]: preference?.data ?? {},
  });
  const data = drafts[jobBoard ?? ""] ?? {};
  function setData(value: PreferenceData) {
    setDrafts((current) => ({ ...current, [jobBoard ?? ""]: value }));
  }
  const [isDefault, setDefault] = useState(preference?.isDefault ?? false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(formData: PreferenceData) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await preferenceRequest<ApplicationPreference>(
        profileId,
        "application-preferences" + (preference ? "/" + preference.id : ""),
        preference ? "PUT" : "POST",
        {
          name,
          data: formData,
          jobBoard,
          isDefault,
          revision: preference?.revision,
        },
      );
      await onSaved(saved);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <FloatingDialog
      title={
        preference
          ? "Edit application preference"
          : "New application preference"
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className="primary"
            disabled={busy}
          >
            <Save size={16} aria-hidden="true" />
            {busy ? "Saving…" : "Save preference"}
          </button>
        </>
      }
    >
      <div className="preference-form">
        <fieldset disabled={busy}>
          <div className="preference-identity">
            <label>
              Name
              <input
                autoFocus
                form={formId}
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Job board
              <select
                value={jobBoard ?? ""}
                disabled={Boolean(preference)}
                onChange={(event) => {
                  setJobBoard(event.target.value || null);
                }}
              >
                <option value="">All job boards</option>
                {schemas
                  .filter(
                    (entry) =>
                      applicationBoard === undefined ||
                      entry.jobBoard === applicationBoard,
                  )
                  .map((entry) => (
                    <option key={entry.jobBoard} value={entry.jobBoard}>
                      {entry.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className="preference-default">
            <input
              type="checkbox"
              checked={isDefault}
              disabled={preference?.isDefault}
              onChange={(event) => setDefault(event.target.checked)}
            />
            Use as default
          </label>
        </fieldset>
        {boardSchema ? (
          <ShadcnForm
            key={jobBoard}
            id={formId}
            className={`preference-schema-fields preference-schema-${jobBoard}`}
            idPrefix={formId}
            schema={boardSchema}
            uiSchema={uiSchema}
            widgets={boardWidgets}
            templates={boardTemplates}
            validator={validator}
            formData={data}
            disabled={busy}
            onChange={({ formData }) => setData(formData ?? {})}
            onSubmit={({ formData }) => void save(formData ?? {})}
          />
        ) : (
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              void save(data);
            }}
          >
            <fieldset disabled={busy}>
              <PreferenceInputs
                data={data as GeneralPreferenceData}
                onChange={setData}
              />
            </fieldset>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </FloatingDialog>
  );
}

export function ApplicationPreferences({
  profileId,
  applicationId,
}: {
  profileId: string;
  applicationId?: string;
}) {
  const [schemas, setSchemas] = useState<BoardPreferenceSchema[]>([]);
  const [applicationBoard, setApplicationBoard] = useState<string | null>();
  const [preferences, setPreferences] = useState<ApplicationPreference[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    ApplicationPreference | null | undefined
  >(undefined);
  const [viewing, setViewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const selectionPath = `applications/${applicationId}/preference`;
  async function load() {
    const [list, selection] = await Promise.all([
      preferenceRequest<{
        preferences: ApplicationPreference[];
        schemas: BoardPreferenceSchema[];
      }>(profileId, "application-preferences"),
      applicationId
        ? preferenceRequest<PreferenceSelection>(profileId, selectionPath)
        : Promise.resolve(null),
    ]);
    if (!Array.isArray(list.preferences))
      throw new Error("Could not load application preferences.");
    setSchemas(list.schemas);
    setApplicationBoard(selection?.jobBoard);
    setPreferences(
      selection
        ? list.preferences.filter(
            (item) => !item.jobBoard || item.jobBoard === selection.jobBoard,
          )
        : list.preferences,
    );
    if (selection) setSelectedId(selection.selectedId);
    else
      setSelectedId((id) =>
        list.preferences.some((item) => item.id === id) ? id : null,
      );
  }
  useEffect(() => {
    let active = true;
    // Remount on profile/application changes so pending operations cannot update another selection.
    load()
      .catch((err) => {
        if (active) setError(String(err));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const defaultPreference =
    preferences.find(
      (item) => item.isDefault && item.jobBoard === applicationBoard,
    ) ?? preferences.find((item) => item.isDefault && !item.jobBoard);
  const selected =
    preferences.find((item) => item.id === selectedId) ?? defaultPreference;
  const selectedSchema = schemas.find(
    (entry) => entry.jobBoard === selected?.jobBoard,
  );
  async function choose(id: string) {
    setBusy(true);
    setError("");
    try {
      if (applicationId)
        await preferenceRequest(profileId, selectionPath, "PUT", {
          preferenceId: id || null,
        });
      setSelectedId(id || null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel application-preferences"
      aria-label="Application preferences"
    >
      <h2>Application preferences</h2>
      {error && <p role="alert">{error}</p>}
      <div className="preference-toolbar">
        <label>
          Saved preference
          <span className="preference-select">
            <select
              disabled={busy}
              value={selectedId ?? ""}
              onChange={(event) => void choose(event.target.value)}
            >
              <option value="">
                Use default
                {defaultPreference ? " — " + defaultPreference.name : ""}
              </option>
              {preferences.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.jobBoard
                    ? " · " +
                      schemas.find((entry) => entry.jobBoard === item.jobBoard)
                        ?.label
                    : ""}
                  {item.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => setEditing(null)}
        >
          <Plus size={16} aria-hidden="true" />
          New preference
        </button>
        {selected && (
          <>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setViewing(true)}
            >
              <Eye size={16} aria-hidden="true" />
              View selected data
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setEditing(selected)}
            >
              <Pencil size={16} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </button>
          </>
        )}
      </div>
      {selected ? (
        <>
          <h3>
            {selected.name}
            {selectedSchema ? " · " + selectedSchema.label : ""}
            {selected.isDefault ? " · Default" : ""}
          </h3>
          <PreferenceDetails
            preference={selected}
            boardSchema={selectedSchema}
          />
        </>
      ) : (
        !busy && (
          <p>Create a preference to save reusable application details.</p>
        )
      )}
      {editing !== undefined && (
        <PreferenceEditor
          profileId={profileId}
          preference={editing}
          schemas={schemas}
          applicationBoard={applicationBoard}
          onSaved={async (saved) => {
            await load();
            if (!applicationId && saved.jobBoard) setSelectedId(saved.id);
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
      {viewing && selected && (
        <FloatingDialog title={selected.name} onClose={() => setViewing(false)}>
          <PreferenceDetails
            preference={selected}
            boardSchema={selectedSchema}
          />
        </FloatingDialog>
      )}
      {deleting && selected && (
        <FloatingDialog
          title="Delete application preference"
          onClose={() => setDeleting(false)}
        >
          <p>
            Delete “{selected.name}”? Applications using this preference will
            use the default. If you delete the default, another saved preference
            becomes the default.
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await preferenceRequest(
                  profileId,
                  "application-preferences/" + selected.id,
                  "DELETE",
                  { revision: selected.revision },
                );
                await load();
                setDeleting(false);
              } catch (err) {
                setError(String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete preference
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setDeleting(false)}
          >
            Cancel
          </button>
          {error && <p role="alert">{error}</p>}
        </FloatingDialog>
      )}
    </section>
  );
}
