import type { Dispatch, SetStateAction } from "react";
import type { Resume } from "../../index";
import type { ContactChoice, ProfileContact } from "../api/client";
type Update<T> = Dispatch<SetStateAction<T>>;
export type Contact = Resume["contact"];
export type ContactKey = keyof Contact;
export type ResumeImportActionsContext = {
  profile: Resume;
  contactId: string | null;
  activeProfileId: string;
  activeResumeId: string | null;
  revisionRef: { current: number };
  contactKeys: ContactKey[];
  pendingImport: Resume | null;
  resume: File | null;
  flushPending: () => Promise<void>;
  setTab: (next: "parser") => void;
  setMessage: Update<string>;
  setImportChoices: Update<Partial<Record<ContactKey, ContactChoice>>>;
  setPendingImport: Update<Resume | null>;
  setContactId: Update<string | null>;
  setProfile: Update<Resume>;
  setResume: Update<File | null>;
  setContacts: Update<ProfileContact[]>;
  setDefaultContactId: Update<string | null>;
  setParseBusy: Update<boolean>;
  setParsePreview: Update<string>;
};

export type OfferImport = (incoming: Resume) => void;
export type ApplyImportedContent = (
  incoming: Resume,
  selectedId: string | null,
  resolved: Resume["contact"],
) => void;
