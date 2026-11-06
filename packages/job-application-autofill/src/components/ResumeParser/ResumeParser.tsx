import type { ApplicationController } from "../../utils/application/useApplication";
export function ResumeParser({
  controller,
}: {
  controller: ApplicationController;
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
        <h2>Resume parser</h2>
        <p>
          Upload a PDF or DOCX to extract contact details and skills. Review the
          results before applying.
        </p>
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
            <strong>{resume?.name || "Drag and drop your resume here"}</strong>
            <p>PDF or DOCX · 10 MB max</p>
            <button
              className="secondary"
              type="button"
              onClick={() => resumeRef.current?.click()}
            >
              Choose resume
            </button>
          </div>
          <button
            className="primary parser-button"
            type="button"
            disabled={parseBusy || !resume}
            onClick={parseResume}
          >
            {parseBusy ? "Parsing..." : "✧ Parse resume"}
          </button>
          <div className="json-import-panel">
            <p>
              <strong>Already have structured résumé JSON?</strong> Import it
              directly—no PDF or DOCX parser needed.
            </p>
            <button
              className="secondary"
              type="button"
              onClick={() => importRef.current?.click()}
            >
              Import résumé JSON
            </button>
          </div>
        </div>
        <div className="parsed-profile">
          <div className="parsed-title">
            <strong>Parsed profile</strong>
            <div className="actions">
              <button className="secondary" onClick={() => setTab("profile")}>
                Edit profile
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
                .join(" ") || "Not extracted"}
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
          <summary>View extracted text preview</summary>
          <pre>{parsePreview}</pre>
        </details>
      )}
    </section>
  );
}
