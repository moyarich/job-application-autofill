import type { Dispatch, SetStateAction } from "react";
import type { CandidateProfile } from "../../index";
import type { ProfileContact } from "../api/client";
export type Contact = CandidateProfile["contact"];
export type ContactKey = keyof Contact;
type Update<T> = Dispatch<SetStateAction<T>>;
export type ContactActionsContext = {
  contactId: string | null;
  contacts: ProfileContact[];
  contactKeys: ContactKey[];
  profile: CandidateProfile;
  activeProfileId: string;
  flushPending: () => Promise<void>;
  setProfile: Update<CandidateProfile>;
  setContacts: Update<ProfileContact[]>;
  setContactId: Update<string | null>;
  setDefaultContactId: Update<string | null>;
  setMessage: Update<string>;
};
