import type { ResumeViewData } from "../feature-props";
import { renderResumeHtml } from "@moyarich/resume/render-html";
import { Pencil, ArrowLeft } from "lucide-react";

import {
  resumeExportFormats,
  type ResumeExportFormat,
} from "../../utils/files/export-resume";
import "./ResumeView.css";
export function ResumeView({ controller }: { controller: ResumeViewData }) {
  const resume = controller.resumeVersions.find(
    (item) => item.id === controller.activeResumeId,
  );
  const html = renderResumeHtml(controller.profile).replace(
    "</style>",
    "body { padding:36px; } </style>",
  );
  return (
    <section className="resume-view">
      <div className="resume-view-toolbar">
        <button
          className="secondary"
          onClick={() => controller.setTab("resumes")}
        >
          <ArrowLeft size={15} /> All resumes
        </button>
        <strong>{resume?.name || "Resume"}</strong>
        <div className="actions">
          <button
            className="primary"
            onClick={() =>
              controller.activeResumeId &&
              void controller.openResume(controller.activeResumeId)
            }
          >
            <Pencil size={15} /> Edit
          </button>
          <select
            aria-label="Export resume"
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
              Export
            </option>
            {resumeExportFormats.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <iframe
        title="Resume preview"
        sandbox=""
        srcDoc={html}
        className="resume-preview"
      />
    </section>
  );
}
