import { RichTextEditor } from "../RichTextEditor/RichTextEditor";
import { Plus, Trash2 } from "lucide-react";
import type { CandidateProfile } from "../../index";
import type { useWorkspace } from "../../hooks/useWorkspace";

type Field<T> = {
  key: keyof T;
  label: string;
  multiline?: boolean;
  list?: boolean;
  nullable?: boolean;
};
function Entries<T extends object>({
  title,
  singular,
  items,
  blank,
  fields,
  onChange,
  richTextSection,
  controller,
}: {
  title: string;
  singular: string;
  items: T[];
  blank: T;
  fields: Field<T>[];
  onChange: (items: T[]) => void;
  richTextSection?: string;
  controller?: ReturnType<typeof useWorkspace>;
}) {
  return (
    <section
      className="panel resume-section-card employment-editor"
      id={"resume-" + title.toLowerCase().replace(/ /g, "-")}
      aria-label={title}
    >
      <div className="panel-title horizontal">
        <div>
          <span className="resume-eyebrow">RESUME CONTENT</span>
          <h2>{title}</h2>
          <p>
            {items.length} {items.length === 1 ? singular : "entries"} on this
            resume
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => onChange([...items, structuredClone(blank)])}
        >
          <Plus size={15} /> Add {singular}
        </button>
      </div>
      {!items.length && (
        <div className="resume-empty-state">
          <Plus size={21} />
          <div>
            <strong>Add your {title.toLowerCase()}</strong>
            <p>Use “Add {singular}” to include this section on your resume.</p>
          </div>
        </div>
      )}
      {items.map((item, index) => (
        <div className="employment-entry" key={index}>
          <div className="profile-grid">
            {fields.map((field) => {
              const raw = item[field.key];
              const value = Array.isArray(raw)
                ? raw.join(", ")
                : String(raw ?? "");
              const change = (text: string) =>
                onChange(
                  items.map((entry, i) =>
                    i === index
                      ? {
                          ...entry,
                          [field.key]: field.list
                            ? text
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean)
                            : field.nullable && !text
                              ? null
                              : text,
                        }
                      : entry,
                  ),
                );
              const Wrapper =
                field.multiline && richTextSection ? "div" : "label";
              return (
                <Wrapper
                  key={String(field.key)}
                  className={
                    field.multiline
                      ? "resume-full-width rich-text-field"
                      : undefined
                  }
                >
                  <span>{field.label}</span>
                  {field.multiline && richTextSection && controller ? (
                    <RichTextEditor
                      key={
                        controller.activeResumeId +
                        "." +
                        richTextSection +
                        "." +
                        index +
                        "." +
                        String(field.key)
                      }
                      label={field.label}
                      value={value}
                      onChange={change}
                    />
                  ) : field.multiline ? (
                    <textarea
                      rows={4}
                      value={value}
                      onChange={(event) => change(event.target.value)}
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(event) => change(event.target.value)}
                    />
                  )}
                </Wrapper>
              );
            })}
          </div>
          <button
            type="button"
            className="remove"
            onClick={() => {
              onChange(items.filter((_, i) => i !== index));
            }}
          >
            <Trash2 size={14} /> Remove {singular}
          </button>
        </div>
      ))}
    </section>
  );
}

const educationFields: Field<CandidateProfile["education"][number]>[] = [
  { key: "institution", label: "Institution" },
  { key: "degree", label: "Degree" },
  { key: "fieldOfStudy", label: "Field of study" },
  { key: "location", label: "Location" },
  { key: "startDate", label: "Start date (YYYY or YYYY-MM)" },
  { key: "endDate", label: "End date (YYYY or YYYY-MM)", nullable: true },
  { key: "description", label: "Education details", multiline: true },
];
const certificationFields: Field<CandidateProfile["certifications"][number]>[] =
  [
    { key: "name", label: "Certification name" },
    { key: "issuer", label: "Issuer" },
    { key: "issuedDate", label: "Issued date (YYYY or YYYY-MM)" },
    {
      key: "expirationDate",
      label: "Expiration date (YYYY or YYYY-MM)",
      nullable: true,
    },
    { key: "credentialId", label: "Credential ID" },
    { key: "url", label: "Credential URL" },
  ];
const projectFields: Field<CandidateProfile["projects"][number]>[] = [
  { key: "name", label: "Project name" },
  { key: "url", label: "Project URL" },
  { key: "technologies", label: "Technologies (comma-separated)", list: true },
  { key: "description", label: "Project description", multiline: true },
];
const sectionFields: Field<{ heading: string; content: string }>[] = [
  { key: "heading", label: "Section heading" },
  { key: "content", label: "Section content", multiline: true },
];

export function ResumeSections({
  controller,
}: {
  controller: ReturnType<typeof useWorkspace>;
}) {
  const { profile, setProfile } = controller;
  return (
    <>
      <Entries
        title="Skill categories"
        singular="skill category"
        items={profile.skillGroups || []}
        blank={{ heading: "", content: "" }}
        fields={[
          { key: "heading", label: "Category" },
          {
            key: "content",
            label: "Skills in this category (comma-separated)",
            multiline: true,
          },
        ]}
        onChange={(skillGroups) =>
          setProfile((p) => ({
            ...p,
            skillGroups,
            skills: [
              ...new Set(
                skillGroups.flatMap((g) =>
                  g.content
                    .split(/[,;•]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                ),
              ),
            ],
          }))
        }
      />
      <Entries
        title="Education"
        richTextSection="education"
        controller={controller}
        singular="education entry"
        items={profile.education}
        fields={educationFields}
        blank={{
          institution: "",
          degree: "",
          fieldOfStudy: "",
          location: "",
          startDate: "",
          endDate: null,
          description: "",
        }}
        onChange={(education) => setProfile((p) => ({ ...p, education }))}
      />
      <Entries
        title="Certifications"
        singular="certification"
        items={profile.certifications}
        fields={certificationFields}
        blank={{
          name: "",
          issuer: "",
          issuedDate: "",
          expirationDate: null,
          credentialId: "",
          url: "",
        }}
        onChange={(certifications) =>
          setProfile((p) => ({ ...p, certifications }))
        }
      />
      <Entries
        title="Projects"
        richTextSection="projects"
        controller={controller}
        singular="project"
        items={profile.projects}
        fields={projectFields}
        blank={{ name: "", description: "", url: "", technologies: [] }}
        onChange={(projects) => setProfile((p) => ({ ...p, projects }))}
      />
      {(["languages", "awards"] as const).map((key) => (
        <section
          className="panel resume-section-card employment-editor"
          id={"resume-" + key}
          key={key}
        >
          <h2>{key === "languages" ? "Languages" : "Awards"}</h2>
          <label>
            {key === "languages"
              ? "Languages (one per line)"
              : "Awards (one per line)"}
            <textarea
              rows={3}
              value={profile[key].join("\n")}
              onChange={(event) => {
                const values = event.target.value.split("\n");
                setProfile((p) => ({ ...p, [key]: values }));
              }}
            />
          </label>
        </section>
      ))}
      <Entries
        title="Additional sections"
        richTextSection="additionalSections"
        controller={controller}
        singular="section"
        items={profile.additionalSections || []}
        fields={sectionFields}
        blank={{ heading: "", content: "" }}
        onChange={(additionalSections) =>
          setProfile((p) => ({ ...p, additionalSections }))
        }
      />
    </>
  );
}
