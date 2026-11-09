import type { ResumeImportActionsContext } from "./import-context";
import type React from "react";

export function createChooseResume(context: ResumeImportActionsContext) {
  const { setMessage, setProfile, setResume } = context;
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
    setProfile((value) => ({
      ...value,
      source: { fileName: file?.name ?? "" },
    }));
    setMessage(
      file ? "Resume selected. Click Import resume to extract details." : "",
    );
  }
  return chooseResume;
}
