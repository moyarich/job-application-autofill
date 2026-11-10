import type {
  ResumeImportActionsContext,
  ApplyImportedContent,
} from "../../types/resume-import-actions-context";
import { requestApi } from "../../api/client";
import { routes } from "../../routes";
import { defaultImportedResumeName } from "./importedResumeName";
import { ContactChoice } from "../../types/api-types";

export function createConfirmImport(
  context: ResumeImportActionsContext & {
    applyImportedContent: ApplyImportedContent;
  },
) {
  const {
    activeProfileId,
    activeResumeId,
    revisionRef,
    contactKeys,
    pendingImport,
    flushPending,
    setMessage,
  } = context;
  let importing = false;
  async function confirmImport(strategy: ContactChoice = "resume") {
    if (!pendingImport || importing) return;
    importing = true;
    try {
      await flushPending();
      const result = await requestApi<{ resumeId: string; revision: number }>(
        "/api/resumes/import",
        {
          resumeId: activeResumeId,
          revision: revisionRef.current,
          name: defaultImportedResumeName(pendingImport),
          profile: pendingImport,
          choices: Object.fromEntries(
            contactKeys.map((key) => [key, strategy]),
          ),
        },
        activeProfileId,
      );
      // Reload the committed resume/contact snapshot; do not autosave stale local state.
      const url = new URL(window.location.href);
      if (!activeResumeId) url.pathname = routes.resumes;
      url.search = "";
      url.searchParams.set("profile", activeProfileId);
      url.searchParams.set("resume", result.resumeId);
      window.location.assign(url.href);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not import resume.",
      );
    } finally {
      importing = false;
    }
  }
  return confirmImport;
}
