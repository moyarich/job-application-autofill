import type { useStoredRecord } from "../hooks/useStoredRecord";
import type { useResumeImport } from "../hooks/useResumeImport";
import type { useApplicationReview } from "../hooks/useApplicationReview";
import type { useJobTracker } from "../hooks/useJobTracker";
import type { createResumeCommands } from "../utils/resumes/commands";
import type { createContactCommands } from "../utils/contacts/commands";
import type { createExportResumePdf } from "../utils/resumes/exportResumePdf";
import type { JobApplication } from "../index";

/** Feature-scoped component props; these are not global controllers. */
export type StoredRecord = ReturnType<typeof useStoredRecord>;
export type ResumeLibraryData = StoredRecord & ReturnType<typeof createResumeCommands>;
export type ProfilePageData = ResumeLibraryData;
export type ResumeEditorData = ResumeLibraryData &
  ReturnType<typeof createContactCommands> &
  ReturnType<typeof useResumeImport> & {
    exportResumePdf: ReturnType<typeof createExportResumePdf>;
  };
export type ResumeImportData = StoredRecord & ReturnType<typeof useResumeImport> & {
  exportResumePdf: ReturnType<typeof createExportResumePdf>;
};
export type ApplicationReviewData = StoredRecord & ReturnType<typeof useApplicationReview>;
export type TrackerData = StoredRecord & ReturnType<typeof useJobTracker> & {
  prepareJob: (job: JobApplication) => void;
};
