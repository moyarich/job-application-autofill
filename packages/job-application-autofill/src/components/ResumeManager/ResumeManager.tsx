import type { ResumeLibraryData } from "../../types/feature-props";
import {
  resumeExportFormats,
  type ResumeExportFormat,
} from "../../utils/files/export-resume";
import { useState, type FormEvent } from "react";
import {
  Copy,
  FilePenLine,
  FilePlus2,
  Pencil,
  Trash2,
  X,
  Search,
  Files,
  Link2,
} from "lucide-react";

import "./ResumeManager.css";

type FormMode = { action: "new" | "copy" | "rename"; resumeId?: string };

export function ResumeManager({
  controller,
}: {
  controller: ResumeLibraryData;
}) {
  const {
    resumeVersions,
    contacts,
    activeResumeId,
    createResume,
    renameResume,
    removeResume,
    openResume,
    exportResumeVersion,
    applicationId,
  } = controller;
  const locked = Boolean(applicationId);
  const [search, setSearch] = useState("");
  const visibleResumes = resumeVersions.filter((resume) =>
    resume.name.toLowerCase().includes(search.toLowerCase()),
  );
  const [form, setForm] = useState<FormMode | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function showForm(action: FormMode["action"], resumeId?: string) {
    const source = resumeVersions.find((item) => item.id === resumeId);
    setForm({ action, resumeId });
    setName(
      action === "new"
        ? ""
        : action === "copy"
          ? (source?.name ?? "Resume") + " (copy)"
          : (source?.name ?? ""),
    );
    setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const title = name.trim();
    if (!title || title.length > 80) {
      setError("Resume name must be between 1 and 80 characters.");
      return;
    }
    setPending(true);
    setError("");
    try {
      if (form.action === "rename" && form.resumeId) {
        await renameResume(form.resumeId, title);
        setForm(null);
      } else {
        await createResume(
          title,
          form.action === "copy" ? form.resumeId : undefined,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save resume.",
      );
    } finally {
      setPending(false);
    }
  }
  async function deleteRow(id: string, title: string) {
    if (
      !window.confirm(
        'Permanently delete resume "' + title + '"? This cannot be undone.',
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      await removeResume(id);
      if (form?.resumeId === id) setForm(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete resume.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel resume-management" aria-label="Resume versions">
      <div className="panel-title horizontal">
        <div>
          <h2>Resumes</h2>
        </div>
        <button
          className="primary"
          type="button"
          onClick={() => showForm("new")}
          disabled={locked || pending}
        >
          <FilePlus2 size={16} /> New resume
        </button>
      </div>
      {error && (
        <p className="resume-management-error" role="alert">
          {error}
        </p>
      )}
      <div className="resume-library-overview">
        <div>
          <Files size={18} />
          <strong>{resumeVersions.length}</strong>
          <span>Resume versions</span>
        </div>
        <div>
          <Link2 size={18} />
          <strong>
            {resumeVersions.filter((resume) => resume.contactId).length}
          </strong>
          <span>Linked to a contact</span>
        </div>
      </div>
      <div className="resume-library-filter">
        <label>
          <Search size={17} />
          <span className="resume-search-label">Search resumes</span>
          <input
            aria-label="Search resumes"
            placeholder="Search your resumes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span>
          {visibleResumes.length}{" "}
          {visibleResumes.length === 1 ? "resume" : "resumes"}
        </span>
      </div>
      <div className="resume-management-list">
        {visibleResumes.map((resume) => {
          const linked = contacts.find(
            (contact) => contact.id === resume.contactId,
          );
          const selected = resume.id === activeResumeId;
          return (
            <article
              key={resume.id}
              className={
                selected
                  ? "resume-management-row selected"
                  : "resume-management-row"
              }
            >
              <div className="resume-management-file" aria-hidden="true">
                <FilePenLine size={20} />
              </div>
              <div className="resume-management-info">
                <div className="resume-management-name">
                  <strong>{resume.name}</strong>
                  {selected && (
                    <span className="resume-management-current">Current</span>
                  )}
                </div>
                <span>
                  {linked
                    ? "Contact: " + linked.name
                    : "Draft · no saved contact"}
                </span>
                <small>
                  Updated {new Date(resume.updatedAt).toLocaleDateString()}
                </small>
              </div>
              <div className="resume-management-actions">
                <button
                  className="secondary"
                  type="button"
                  disabled={locked || pending}
                  onClick={() => void openResume(resume.id, "view")}
                >
                  View
                </button>
                <button
                  className={selected ? "secondary" : "primary"}
                  type="button"
                  disabled={locked || pending}
                  onClick={() => void openResume(resume.id)}
                >
                  <FilePenLine size={14} /> Edit
                </button>
                <button
                  className="secondary"
                  type="button"
                  disabled={locked || pending}
                  onClick={() => showForm("copy", resume.id)}
                >
                  <Copy size={14} /> Copy
                </button>
                <button
                  className="secondary"
                  type="button"
                  disabled={locked || pending}
                  onClick={() => showForm("rename", resume.id)}
                >
                  <Pencil size={14} /> Rename
                </button>
                <select
                  aria-label={"Export " + resume.name}
                  disabled={locked || pending}
                  value=""
                  onChange={(event) =>
                    void exportResumeVersion(
                      resume.id,
                      event.target.value as ResumeExportFormat,
                    )
                  }
                >
                  <option value="" disabled>
                    Export
                  </option>
                  {resumeExportFormats.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary resume-management-delete"
                  type="button"
                  disabled={locked || pending}
                  title="Delete resume"
                  onClick={() => void deleteRow(resume.id, resume.name)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!visibleResumes.length && (
        <div className="resume-library-empty">
          <Search size={25} />
          <h3>
            {resumeVersions.length === 0
              ? "No resumes yet"
              : "No resumes found"}
          </h3>
        </div>
      )}
      {form && (
        <form
          className="resume-management-form"
          onSubmit={(event) => void submit(event)}
        >
          <div className="resume-management-form-heading">
            <h3>
              {form.action === "new"
                ? "Create resume"
                : form.action === "copy"
                  ? "Duplicate resume"
                  : "Rename resume"}
            </h3>
            <button
              className="secondary"
              type="button"
              onClick={() => setForm(null)}
              aria-label="Cancel resume changes"
              disabled={pending}
            >
              <X size={16} />
            </button>
          </div>
          <p>
            {form.action === "new"
              ? "Start with a blank resume. If this profile has a default contact, it will be linked automatically."
              : form.action === "copy"
                ? "Create a separate resume version with the source resume's content and contact link."
                : "Change the name without changing this resume's contents."}
          </p>
          <label htmlFor="resume-management-name">
            Resume name
            <input
              id="resume-management-name"
              required
              maxLength={80}
              value={name}
              placeholder="e.g. Platform Engineer"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="actions">
            <button className="primary" type="submit" disabled={pending}>
              {pending
                ? "Saving..."
                : form.action === "rename"
                  ? "Save name"
                  : "Create resume"}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={pending}
              onClick={() => setForm(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
