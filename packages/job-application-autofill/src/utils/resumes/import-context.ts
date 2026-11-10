import type { Dispatch, SetStateAction } from "react";
import type { CandidateProfile } from "../../index";
import type { ContactChoice, ProfileContact } from "../api/client";
type Update<T> = Dispatch<SetStateAction<T>>;
export type Contact = CandidateProfile["contact"];
export type ContactKey = keyof Contact;
export type ResumeImportActionsContext = {
  profile: CandidateProfile;
  contactId: string | null;
  activeProfileId: string;
  activeResumeId: string | null;
  revisionRef: { current: number };
  contactKeys: ContactKey[];
  pendingImport: CandidateProfile | null;
  resume: File | null;
  flushPending: () => Promise<void>;
  setTab: (next: "parser") => void;
  setMessage: Update<string>;
  setImportChoices: Update<Partial<Record<ContactKey, ContactChoice>>>;
  setPendingImport: Update<CandidateProfile | null>;
  setContactId: Update<string | null>;
  setProfile: Update<CandidateProfile>;
  setResume: Update<File | null>;
  setContacts: Update<ProfileContact[]>;
  setDefaultContactId: Update<string | null>;
  setParseBusy: Update<boolean>;
  setParsePreview: Update<string>;
};

export type OfferImport = (incoming: CandidateProfile) => void;
export type ApplyImportedContent = (
  incoming: CandidateProfile,
  selectedId: string | null,
  resolved: CandidateProfile["contact"],
) => void;
