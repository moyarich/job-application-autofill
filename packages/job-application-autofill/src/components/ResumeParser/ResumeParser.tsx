import { useState } from "react";
import {
  ArrowRight,
  Check,
  FileJson,
  FileText,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import type { ResumeImportData } from "../feature-props";
import "./ResumeParser.css";

export function ResumeParser({ controller }: { controller: ResumeImportData }) {
  const {
    resumeRef,
    chooseResume,
    importRef,
    importProfile,
    setMessage,
    setResume,
    setProfile,
    resume,
    parseBusy,
    parseResume,
    setTab,
    profile,
    parsePreview,
    pendingImport,
  } = controller;
  const [dragging, setDragging] = useState(false);
  const selected = controller.resumeVersions.find(
    (item) => item.id === controller.activeResumeId,
  );
  const details = pendingImport ?? profile;
  const name = [details.contact.firstName, details.contact.lastName]
    .filter(Boolean)
    .join(" ");
  return (
    <section className="panel resume-import" aria-label="Import resume">
      <div className="import-destination">
        <span className="import-file-icon">
          <FileText size={22} aria-hidden="true" />
        </span>
        <div>
          <span className="import-eyebrow">Importing into</span>
          <strong>{selected?.name ?? "Selected resume"}</strong>
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() => setTab("resumes")}
          disabled={parseBusy}
        >
          Change resume
        </button>
      </div>
      <ol className="import-steps" aria-label="Import steps">
        <li aria-current={!resume ? "step" : undefined}>
          <span>{resume ? <Check size={14} /> : "1"}</span>Choose a file
        </li>
        <li
          aria-current={
            resume && !pendingImport && !parsePreview ? "step" : undefined
          }
        >
          <span>2</span>Import details
        </li>
        <li aria-current={pendingImport || parsePreview ? "step" : undefined}>
          <span>3</span>Review resume
        </li>
      </ol>
      <div className="parser-grid">
        <div className="parser-left">
          <div className="import-section-heading">
            <h2>Bring your experience along</h2>
            <p>
              Upload your resume to fill in your experience, education, and
              skills.
            </p>
          </div>
          <input
            ref={resumeRef}
            hidden
            type="file"
            aria-label="Choose resume document"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={chooseResume}
            disabled={parseBusy}
          />
          <input
            ref={importRef}
            hidden
            type="file"
            aria-label="Choose resume JSON"
            accept=".json,application/json"
            onChange={importProfile}
            disabled={parseBusy}
          />
          <div
            className={`drop-zone${dragging ? " dragging" : ""}${resume ? " has-file" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!parseBusy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (parseBusy) return;
              const file = event.dataTransfer.files[0];
              if (!file) return;
              if (
                !/\.(pdf|docx)$/i.test(file.name) ||
                file.size > 10 * 1024 * 1024
              ) {
                setMessage("Choose a PDF or DOCX resume of 10 MB or less.");
                return;
              }
              setResume(file);
              setProfile((value) => ({
                ...value,
                source: { fileName: file.name },
              }));
              setMessage("Resume ready to import.");
            }}
          >
            <span className="upload-symbol">
              {resume ? <FileText size={27} /> : <Upload size={27} />}
            </span>
            <strong>{resume?.name || "Drop your resume here"}</strong>
            <p>
              {resume
                ? `${(resume.size / 1024).toFixed(1)} KB · Ready to import`
                : "PDF or Word document · Up to 10 MB"}
            </p>
            <div className="actions">
              <button
                className="secondary"
                type="button"
                disabled={parseBusy}
                onClick={() => resumeRef.current?.click()}
              >
                {resume ? "Choose another file" : "Browse files"}
              </button>
              {resume && (
                <button
                  className="secondary"
                  type="button"
                  disabled={parseBusy}
                  aria-label="Remove selected file"
                  onClick={() => {
                    setResume(null);
                    if (resumeRef.current) resumeRef.current.value = "";
                    setMessage("");
                  }}
                >
                  <X size={16} /> Remove
                </button>
              )}
            </div>
          </div>
          <button
            className="primary parser-button"
            type="button"
            disabled={parseBusy || !resume}
            onClick={parseResume}
          >
            {parseBusy ? (
              <LoaderCircle size={17} className="import-spinner" />
            ) : (
              <Upload size={17} />
            )}
            {parseBusy ? "Importing…" : "Import resume"}
            {!parseBusy && <ArrowRight size={16} />}
          </button>
          <p className="import-helper" role="status">
            {parseBusy
              ? "Extracting your resume details. This may take a moment."
              : "Review imported details before using your resume."}
          </p>
          <div className="json-import-panel">
            <FileJson size={23} aria-hidden="true" />
            <div>
              <strong>Already have resume JSON?</strong>
              <p>Bring in a previously exported resume.</p>
            </div>
            <button
              className="secondary"
              type="button"
              disabled={parseBusy}
              onClick={() => importRef.current?.click()}
            >
              Import resume JSON
            </button>
          </div>
        </div>
        <aside className="parsed-profile" aria-label="Resume details">
          <div className="parsed-title">
            <span className="import-eyebrow">
              {pendingImport ? "Imported details" : "Current resume"}
            </span>
            <h3>Your resume at a glance</h3>
            <p>
              {pendingImport
                ? "Review the imported contact details below to finish."
                : "Imported content will be added to this resume."}
            </p>
          </div>
          <dl className="import-details">
            <div>
              <dt>Name</dt>
              <dd>{name || "Not added yet"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{details.contact.email || "Not added yet"}</dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>
                {details.skills.length ? (
                  <div className="import-skills">
                    {details.skills.map((skill, index) => (
                      <span key={`${skill}-${index}`}>{skill}</span>
                    ))}
                  </div>
                ) : (
                  "No skills yet"
                )}
              </dd>
            </div>
          </dl>
          <button
            className="secondary"
            type="button"
            disabled={parseBusy}
            onClick={() => setTab("profile")}
          >
            Open resume editor <ArrowRight size={15} />
          </button>
        </aside>
      </div>
      {parsePreview && (
        <details className="text-preview">
          <summary>View extracted document text</summary>
          <pre>{parsePreview}</pre>
        </details>
      )}
    </section>
  );
}
