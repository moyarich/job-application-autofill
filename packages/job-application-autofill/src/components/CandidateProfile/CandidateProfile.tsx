import { useEffect, useRef, useState } from "react";
import {
  resumeExportFormats,
  type ResumeExportFormat,
} from "../../utils/files/export-resume";
import { RichTextEditor } from "../RichTextEditor/RichTextEditor";
import "./CandidateProfile.css";
import { ResumeSections } from "./ResumeSections";
import {
  FileText,
  FileUp,
  Plus,
  Trash2,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { fields } from "../../utils/profile/fields";
import type { useWorkspace } from "../../hooks/useWorkspace";
import type { useResumeImport } from "../../hooks/useResumeImport";
/** Keep incomplete comma-separated text while persisting only complete skill values. */
function SkillsInput({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
}) {
  const [draft, setDraft] = useState(() => skills.join(", "));
  const lastEmitted = useRef(JSON.stringify(skills));

  // Refresh the editor when skills change from an import or another section.
  useEffect(() => {
    const next = JSON.stringify(skills);
    if (next !== lastEmitted.current) {
      setDraft(skills.join(", "));
      lastEmitted.current = next;
    }
  }, [skills]);

  return (
    <label className="wide-label">
      Skills (comma-separated)
      <textarea
        rows={2}
        value={draft}
        onChange={(event) => {
          const text = event.target.value;
          const next = text.split(",").map((skill) => skill.trim()).filter(Boolean);
          setDraft(text);
          lastEmitted.current = JSON.stringify(next);
          onChange(next);
        }}
        onBlur={() => setDraft(skills.join(", "))}
        placeholder="React, AWS, TypeScript"
      />
    </label>
  );
}

export function CandidateProfile({
  controller,
}: {
  controller: ReturnType<typeof useWorkspace> & ReturnType<typeof useResumeImport>;
}) {
  const {
    importRef,
    importProfile,
    profile,
    exportResumePdf,
    setProfile,
    contacts,
    contactId,
    defaultContactId,
    chooseContact,
    markDefaultContact,
    saveContactRecord,
    editContact,
    errors,
  } = controller;
  const currentResume = controller.resumeVersions.find(
    (item) => item.id === controller.activeResumeId,
  );
  const sections = [
    [
      "contact",
      "Contact",
      Object.values(profile.contact).filter(Boolean).length,
    ],
    ["summary", "Summary", profile.summary.trim() ? 1 : 0],
    ["skills", "Skills", profile.skills.length],
    ["experience", "Experience", profile.experience.length],
    ["skill-categories", "Skill categories", profile.skillGroups?.length || 0],
    ["education", "Education", profile.education.length],
    ["certifications", "Certifications", profile.certifications.length],
    ["projects", "Projects", profile.projects.length],
    ["languages", "Languages", profile.languages.filter(Boolean).length],
    ["awards", "Awards", profile.awards.filter(Boolean).length],
    [
      "additional-sections",
      "Additional sections",
      profile.additionalSections?.length || 0,
    ],
  ] as const;
  return (
    <div className="resume-workspace">
      <header className="resume-toolbar">
        <div className="resume-document-icon">
          <FileText size={23} />
        </div>
        <div className="resume-document-info">
          <span className="resume-eyebrow">YOUR DOCUMENT</span>
          <label
            htmlFor="editor-resume-version"
            className="resume-version-label"
          >
            Resume version
          </label>
          <select
            id="editor-resume-version"
            value={controller.activeResumeId || ""}
            onChange={(event) =>
              void controller.switchResume(event.target.value)
            }
          >
            {controller.resumeVersions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span className="resume-autosave">Changes save automatically</span>
        </div>
        <div className="actions resume-export-actions">
          <input
            ref={importRef}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={importProfile}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => importRef.current?.click()}
          >
            <FileUp size={15} /> Import JSON
          </button>
          <select
            className="resume-export-select"
            aria-label="Download resume format"
            value=""
            onChange={(event) =>
              controller.activeResumeId &&
              void controller.exportResumeVersion(
                controller.activeResumeId,
                event.target.value as ResumeExportFormat,
              )
            }
          >
            <option value="" disabled>
              More formats
            </option>
            {resumeExportFormats.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" className="primary" onClick={exportResumePdf}>
            <FileText size={15} /> Export PDF
          </button>
        </div>
      </header>
      <div className="resume-editor-layout">
        <nav className="resume-section-nav" aria-label="Resume sections">
          <div className="resume-nav-heading">
            <Layers size={15} /> SECTIONS
          </div>
          {sections.map(([id, label, count], index) => (
            <a key={id} href={"#resume-" + id}>
              <span className="resume-section-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{label}</span>
              <span className="resume-section-count">{count}</span>
            </a>
          ))}
          <button
            type="button"
            className="resume-manage-link"
            onClick={() => controller.setTab("resumes")}
          >
            Manage resumes <ArrowUpRight size={14} />
          </button>
        </nav>
        <div className="resume-editor-content">
          <section className="panel resume-section-card" id="resume-contact">
            <div className="panel-title">
              <span className="resume-eyebrow">01 / PERSONAL INFORMATION</span>
              <h2>Contact details</h2>
              <p>Choose the contact details to include on this resume.</p>
            </div>
            <div className="contact-record-selector">
              <label htmlFor="resume-contact-record">Selected contact</label>
              <select
                id="resume-contact-record"
                value={contactId ?? ""}
                onChange={(event) => chooseContact(event.target.value)}
              >
                <option value="">Draft — no saved contact</option>
                {contacts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              {!contactId && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => void saveContactRecord()}
                >
                  Save contact
                </button>
              )}
              {contactId && contactId !== defaultContactId && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void markDefaultContact()}
                >
                  Set as default
                </button>
              )}
              <p className="contact-hint">
                {contactId
                  ? "Edits to this contact are reflected in other resumes linked to the same record."
                  : "Draft contact details are kept with this resume. Save a complete contact to enable applications."}
              </p>
            </div>
            <div className="profile-grid">
              {fields.map(({ key, label }) => (
                <label key={key}>
                  {label}
                  <input
                    type={key === "email" ? "email" : "text"}
                    value={profile.contact[key] || ""}
                    onChange={(e) => editContact(key, e.target.value)}
                    placeholder={label}
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="panel resume-section-card" id="resume-summary">
            <div className="panel-title">
              <span className="resume-eyebrow">02 / INTRODUCTION</span>
              <h2>Professional summary</h2>
              <p>
                A clear introduction to your experience and the value you bring.
              </p>
            </div>
            <div className="wide-label rich-text-field">
              <span>Resume-specific professional summary</span>
              <RichTextEditor
                key={controller.activeResumeId + ".summary"}
                label="Resume-specific professional summary"
                value={profile.summary}
                onChange={(e) => setProfile((x) => ({ ...x, summary: e }))}
                placeholder="Brief summary of your experience..."
              />
            </div>
          </section>
          <section className="panel resume-section-card" id="resume-skills">
            <div className="panel-title">
              <span className="resume-eyebrow">03 / EXPERTISE</span>
              <h2>Skills</h2>
              <p>
                Highlight your strengths. Editing this list replaces the skill
                categories below.
              </p>
            </div>
            <SkillsInput
              key={controller.activeResumeId}
              skills={profile.skills}
              onChange={(skills) =>
                setProfile((x) => ({ ...x, skillGroups: [], skills }))
              }
            />
          </section>
          <section
            className="panel resume-section-card employment-editor"
            id="resume-experience"
          >
            <div className="panel-title horizontal">
              <div>
                <h2>Work experience for this resume</h2>
                <p>
                  Titles, dates, and descriptions can differ between resume
                  versions.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  setProfile((x) => ({
                    ...x,
                    experience: [
                      ...x.experience,
                      {
                        company: "",
                        jobTitle: "",
                        location: "",
                        startDate: "",
                        endDate: null,
                        isCurrent: false,
                        description: "",
                      },
                    ],
                  }))
                }
              >
                <Plus size={15} /> Add position
              </button>
            </div>
            {profile.experience.map((job, index) => (
              <div className="employment-entry" key={index}>
                <div className="resume-entry-heading">
                  <span className="resume-entry-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{job.jobTitle || "New position"}</h3>
                    <p>
                      {job.company || "Add an employer"}
                      {job.isCurrent ? " · Current role" : ""}
                    </p>
                  </div>
                </div>
                <div className="profile-grid">
                  {(
                    ["company", "jobTitle", "location", "startDate"] as const
                  ).map((key) => (
                    <label key={key}>
                      {
                        {
                          company: "Employer",
                          jobTitle: "Job title",
                          location: "Location",
                          startDate: "Start date (YYYY-MM)",
                        }[key]
                      }
                      <input
                        value={job[key]}
                        onChange={(e) =>
                          setProfile((x) => ({
                            ...x,
                            experience: x.experience.map((item, i) =>
                              i === index
                                ? { ...item, [key]: e.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  ))}
                  <label>
                    End date (YYYY-MM)
                    <input
                      disabled={job.isCurrent}
                      value={job.endDate ?? ""}
                      onChange={(e) =>
                        setProfile((x) => ({
                          ...x,
                          experience: x.experience.map((item, i) =>
                            i === index
                              ? { ...item, endDate: e.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="review-checkbox">
                    <input
                      type="checkbox"
                      checked={job.isCurrent}
                      onChange={(e) =>
                        setProfile((x) => ({
                          ...x,
                          experience: x.experience.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  isCurrent: e.target.checked,
                                  endDate: e.target.checked ? null : "",
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                    Current role
                  </label>
                </div>
                <div className="wide-label rich-text-field">
                  <span>Highlights and responsibilities</span>
                  <RichTextEditor
                    key={controller.activeResumeId + ".experience." + index}
                    label="Highlights and responsibilities"
                    bullets
                    value={job.description}
                    onChange={(e) =>
                      setProfile((x) => ({
                        ...x,
                        experience: x.experience.map((item, i) =>
                          i === index ? { ...item, description: e } : item,
                        ),
                      }))
                    }
                  />
                </div>
                <button
                  className="remove"
                  aria-label="Remove employment entry"
                  onClick={() =>
                    setProfile((x) => ({
                      ...x,
                      experience: x.experience.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 size={14} aria-hidden="true" /> Remove position
                </button>
              </div>
            ))}
          </section>
          <ResumeSections controller={controller} />
          <div className={errors.length ? "validation warning" : "validation"}>
            {errors.length
              ? "Please complete: " + errors.join(", ")
              : contactId
                ? "Resume contact is ready for applications."
                : "Save a contact record before applying."}
          </div>
          <p className="resume-document-note">
            Editing {currentResume?.name || "your resume"}. Resume content stays
            independent from your other versions.
          </p>
        </div>
      </div>
    </div>
  );
}
