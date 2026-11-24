import { adapterForUrl } from "@moyarich/job-boards";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const FIELDS = [
  "country",
  "workAuthorization",
  "sponsorship",
  "salary",
  "currency",
  "relocation",
  "workArrangement",
  "availability",
  "travel",
  "employmentType",
  "salaryMinimum",
  "salaryMaximum",
  "salaryPeriod",
  "availabilityType",
  "startDate",
  "noticePeriod",
  "noticeUnit",
] as const;

type PreferenceRow = {
  id: string;
  name: string;
  isDefault: number;
  dataJson: string;
  jobBoard: string | null;
  revision: number;
  updatedAt: string;
};

export function createApplicationPreferences(
  db: DatabaseSync,
  requireProfile: (id: string) => string,
) {
  const select = `SELECT id,name,is_default AS isDefault,data_json AS dataJson,
    job_board AS jobBoard,revision,updated_at AS updatedAt FROM application_preferences WHERE profile_id=?`;
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const schemas = db
    .prepare(
      "SELECT job_board AS jobBoard,label,schema_json AS schemaJson FROM application_preference_schemas ORDER BY label",
    )
    .all()
    .map(({ jobBoard, label, schemaJson }) => ({
      jobBoard: String(jobBoard),
      label: String(label),
      schema: JSON.parse(String(schemaJson)) as AnySchema,
    }));
  const validators = new Map(
    schemas.map(({ jobBoard, schema }) => [jobBoard, ajv.compile(schema)]),
  );
  function listApplicationPreferenceSchemas() {
    return schemas;
  }
  function listApplicationPreferences(profileId: string) {
    const rows = db
      .prepare(select + " ORDER BY is_default DESC,name,id")
      .all(requireProfile(profileId)) as PreferenceRow[];
    return rows.map(({ dataJson, isDefault, ...row }) => ({
      ...row,
      isDefault: Boolean(isDefault),
      data: JSON.parse(dataJson) as Record<string, string | number | string[]>,
    }));
  }
  function transaction<T>(action: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function saveApplicationPreference(
    profileId: string,
    id: string | null,
    raw: unknown,
  ) {
    const owner = requireProfile(profileId);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Invalid application preference.");
    const value = raw as Record<string, unknown>;
    if (
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 120 ||
      typeof value.isDefault !== "boolean" ||
      !value.data ||
      typeof value.data !== "object" ||
      Array.isArray(value.data)
    )
      throw new Error("Enter a name and valid preference data.");
    const jobBoard = value.jobBoard ?? null;
    if (
      jobBoard !== null &&
      (typeof jobBoard !== "string" || !validators.has(jobBoard))
    )
      throw new Error("Choose a supported job board.");
    const data = value.data as Record<string, unknown>;
    if (jobBoard !== null && !validators.get(jobBoard)!(data))
      throw new Error("Invalid preference data for this job board.");
    if (
      jobBoard === null &&
      Object.entries(data).some(
        ([key, field]) =>
          !FIELDS.includes(key as (typeof FIELDS)[number]) ||
          typeof field !== "string" ||
          field.length > 1000,
      )
    )
      throw new Error("Invalid preference field.");
    for (const key of ["salaryMinimum", "salaryMaximum", "noticePeriod"]) {
      const field = data[key];
      if (
        typeof field === "string" &&
        field !== "" &&
        (!/^\d+(?:\.\d{1,2})?$/.test(field) ||
          !Number.isFinite(Number(field)) ||
          (key === "noticePeriod" && !Number.isInteger(Number(field))))
      )
        throw new Error(
          "Enter valid nonnegative salary and notice period values.",
        );
    }
    if (
      data.salaryMinimum &&
      data.salaryMaximum &&
      Number(data.salaryMinimum) > Number(data.salaryMaximum)
    )
      throw new Error("Maximum salary must be at least the minimum salary.");
    const name = value.name.trim();
    return transaction(() => {
      const current = id
        ? (db.prepare(select + " AND id=?").get(owner, id) as
            PreferenceRow | undefined)
        : undefined;
      if (id && (!current || current.revision !== value.revision))
        throw new Error(
          "This preference changed or was deleted. Reload before saving.",
        );
      if (current && current.jobBoard !== jobBoard)
        throw new Error(
          "The job board of a saved preference cannot be changed.",
        );
      const first = !db
        .prepare(select + " AND job_board IS ? LIMIT 1")
        .get(owner, jobBoard);
      const isDefault = first || value.isDefault || Boolean(current?.isDefault);
      if (isDefault)
        db.prepare(
          "UPDATE application_preferences SET is_default=0,revision=revision+1 WHERE profile_id=? AND job_board IS ? AND is_default=1 AND id<>?",
        ).run(owner, jobBoard, id ?? "");
      const savedId = id ?? randomUUID();
      db.prepare(
        `INSERT INTO application_preferences(id,profile_id,name,is_default,data_json,job_board,revision,updated_at)
        VALUES(?,?,?,?,?,?,1,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,is_default=excluded.is_default,
        data_json=excluded.data_json,revision=application_preferences.revision+1,updated_at=excluded.updated_at`,
      ).run(
        savedId,
        owner,
        name,
        Number(isDefault),
        JSON.stringify(data),
        jobBoard,
        new Date().toISOString(),
      );
      return listApplicationPreferences(owner).find(
        (item) => item.id === savedId,
      )!;
    });
  }
  function deleteApplicationPreference(
    profileId: string,
    id: string,
    revision: number,
  ) {
    const owner = requireProfile(profileId);
    transaction(() => {
      const removed = db
        .prepare(
          "DELETE FROM application_preferences WHERE profile_id=? AND id=? AND revision=? RETURNING job_board AS jobBoard,is_default AS isDefault",
        )
        .get(owner, id, revision);
      if (!removed)
        throw new Error(
          "This preference changed or was deleted. Reload before deleting.",
        );
      if (removed.isDefault)
        db.prepare(
          `UPDATE application_preferences SET is_default=1,revision=revision+1 WHERE id=(
          SELECT id FROM application_preferences WHERE profile_id=? AND job_board IS ? ORDER BY name,id LIMIT 1)`,
        ).run(owner, removed.jobBoard);
    });
  }
  function requireApplication(profileId: string, applicationId: string) {
    const owner = requireProfile(profileId);
    const application = db
      .prepare("SELECT url FROM applications WHERE profile_id=? AND id=?")
      .get(owner, applicationId) as { url: string } | undefined;
    if (!application) throw new Error("Application not found.");
    const board = adapterForUrl(application.url)?.id;
    return { owner, jobBoard: board && validators.has(board) ? board : null };
  }
  function getApplicationPreference(profileId: string, applicationId: string) {
    const { owner, jobBoard } = requireApplication(profileId, applicationId);
    const selection = db
      .prepare(
        "SELECT preference_id AS id FROM application_preference_selections WHERE profile_id=? AND application_id=?",
      )
      .get(owner, applicationId) as { id: string } | undefined;
    const preferences = listApplicationPreferences(owner).filter(
      (preference) =>
        preference.jobBoard === null || preference.jobBoard === jobBoard,
    );
    const selected = preferences.find(
      (preference) => preference.id === selection?.id,
    );
    return {
      jobBoard,
      selectedId: selected?.id ?? null,
      preference:
        selected ??
        preferences.find((p) => p.isDefault && p.jobBoard === jobBoard) ??
        preferences.find((p) => p.isDefault) ??
        null,
    };
  }
  function selectApplicationPreference(
    profileId: string,
    applicationId: string,
    id: string | null,
  ) {
    return transaction(() => {
      const { owner, jobBoard } = requireApplication(profileId, applicationId);
      if (id === null)
        db.prepare(
          "DELETE FROM application_preference_selections WHERE profile_id=? AND application_id=?",
        ).run(owner, applicationId);
      else {
        if (
          !db
            .prepare(
              select + " AND id=? AND (job_board IS NULL OR job_board=?)",
            )
            .get(owner, id, jobBoard)
        )
          throw new Error("Preference not available for this application.");
        db.prepare(
          `INSERT INTO application_preference_selections VALUES(?,?,?)
          ON CONFLICT(profile_id,application_id) DO UPDATE SET preference_id=excluded.preference_id`,
        ).run(owner, applicationId, id);
      }
      return getApplicationPreference(owner, applicationId);
    });
  }
  return {
    listApplicationPreferenceSchemas,
    listApplicationPreferences,
    saveApplicationPreference,
    deleteApplicationPreference,
    getApplicationPreference,
    selectApplicationPreference,
  };
}
