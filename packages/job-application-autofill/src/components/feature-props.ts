import type { useProfileSelection } from "../hooks/useProfileSelection";
import type { useProfileContacts } from "../hooks/useProfileContacts";
import type { useResumeDraft } from "../hooks/useResumeDraft";
import type { useJobApplications } from "../hooks/useJobApplications";
import type { useResumeImport } from "../hooks/useResumeImport";
import type { useApplicationReview } from "../hooks/useApplicationReview";
import type { useJobTracker } from "../hooks/useJobTracker";
import type { createResumeCommands } from "../utils/resumes/commands";
import type { createContactCommands } from "../utils/contacts/commands";
import type { createExportResumePdf } from "../utils/resumes/exportResumePdf";
import type { ProfileContact } from "../utils/api/client";
import type { ContactKey } from "../utils/contacts/contact-context";
import type { JobApplication } from "../index";

type Selection = ReturnType<typeof useProfileSelection>;
type Contacts = ReturnType<typeof useProfileContacts>;
type Resume = ReturnType<typeof useResumeDraft>;
type Jobs = ReturnType<typeof useJobApplications>;
type ResumeCommands = ReturnType<typeof createResumeCommands>;
type ContactCommands = ReturnType<typeof createContactCommands>;
type Import = ReturnType<typeof useResumeImport>;
type Review = ReturnType<typeof useApplicationReview>;
type Tracker = ReturnType<typeof useJobTracker>;
type Flush = { flushPending: () => Promise<void> };

export type ContactManagerData = Selection & Contacts & Flush;
export type ResumeSectionsData = Selection & Resume;
export type ResumeLibraryData = Selection & Contacts & ResumeCommands & Flush;
export type ResumeViewData = ResumeLibraryData & Resume;
type ContactSelection = {
  selectedContact: ProfileContact | undefined;
  defaultContact: ProfileContact | undefined;
  contactKeys: ContactKey[];
};
export type ResumeEditorData = ResumeViewData &
  ContactCommands &
  Import &
  ContactSelection & {
    exportResumePdf: ReturnType<typeof createExportResumePdf>;
  };
export type ResumeImportData = Selection &
  Contacts &
  Resume &
  Import &
  ContactSelection &
  Flush;
export type ApplicationReviewData = Selection & Jobs & Resume & Review;
export type TrackerData = Selection &
  Jobs &
  Tracker & {
    prepareJob: (job: JobApplication) => void;
  };
