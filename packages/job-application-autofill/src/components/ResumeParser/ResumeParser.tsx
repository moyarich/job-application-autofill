import type { ResumeImportData } from "../feature-props";
import "./ResumeParser.css";


export function ResumeParser({
  controller,
}: {
  controller: ResumeImportData;
}) {
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
    exportResumePdf,
    profile,
    parsePreview,
  } = controller;
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Upload a resume file</h2>
      </div>
      <div className="parser-grid">
        <div className="parser-left">
          <input
            ref={resumeRef}
            hidden
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={chooseResume}
          />
          <input
            ref={importRef}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={importProfile}
          />
          <div
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                if (
                  !/\.(pdf|docx)$/i.test(file.name) ||
                  file.size > 10 * 1024 * 1024
                ) {
                  setMessage("Choose a PDF or DOCX resume of 10 MB or less.");
                  return;
                }
                setResume(file);
                setProfile((p) => ({ ...p, source: { fileName: file.name } }));
                setMessage("Resume ready to parse.");
              }
            }}
          >
            <div className="upload-symbol">⇧</div>
            <strong>{resume?.name || "Drop a PDF or DOCX here"}</strong>
            <p>PDF or DOCX · 10 MB max</p>
            <button
              className="secondary"
              type="button"
              onClick={() => resumeRef.current?.click()}
            >
              Browse files
            </button>
          </div>
          <button
            className="primary parser-button"
            type="button"
            disabled={parseBusy || !resume}
            onClick={parseResume}
          >
            {parseBusy ? "Importing..." : "Import resume"}
          </button>
          <div className="json-import-panel">
            <p>
              <strong>Import from JSON</strong>
            </p>
            <button
              className="secondary"
              type="button"
              onClick={() => importRef.current?.click()}
            >
              Choose JSON file
            </button>
          </div>
        </div>
        <div className="parsed-profile">
          <div className="parsed-title">
            <strong>Current resume details</strong>
            <div className="actions">
              <button className="secondary" onClick={() => setTab("profile")}>
                Edit resume
              </button>
              <button className="secondary" onClick={exportResumePdf}>
                Export PDF
              </button>
            </div>
          </div>
          <div>
            <span>Name</span>
            <strong>
              {[profile.contact.firstName, profile.contact.lastName]
                .filter(Boolean)
                .join(" ") || "Not available"}
            </strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{profile.contact.email || "Not extracted"}</strong>
          </div>
          <div>
            <span>Skills</span>
            <strong>{profile.skills.join(", ") || "Not extracted"}</strong>
          </div>
          <div>
            <span>Resume</span>
            <strong>{profile.source.fileName || "Not selected"}</strong>
          </div>
        </div>
      </div>
      {parsePreview && (
        <details className="text-preview">
          <summary>View extracted text</summary>
          <pre>{parsePreview}</pre>
        </details>
      )}
    </section>
  );
}
