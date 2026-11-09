import type { ResumeImportActionsContext } from "./import-context";
import type React from "react";

export function createChooseResume(context: ResumeImportActionsContext) {
  const { setMessage, setResume } = context;
  function chooseResume(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (
      file &&
      (!/\.(pdf|docx)$/i.test(file.name) || file.size > 10 * 1024 * 1024)
    ) {
      setMessage("Choose a PDF or DOCX resume of 10 MB or less.");
      return;
    }
    setResume(file);
    setMessage(
      file ? "Resume selected. Click Extract details to extract details." : "",
    );
  }
  return chooseResume;
}
