import { Resume } from "@moyarich/resume";
import type { Dispatch, SetStateAction } from "react";

import { ProfileContact } from "./api-types";
import { EMPTY_CANDIDATE } from "../constants";

export type Contact = Resume["contact"];
export type ContactKey = keyof Contact;
export const contactKeys = Object.keys(EMPTY_CANDIDATE.contact) as ContactKey[];
type Update<T> = Dispatch<SetStateAction<T>>;
export type ContactActionsContext = {
  contactId: string | null;
  contacts: ProfileContact[];
  contactKeys: ContactKey[];
  profile: Resume;
  activeProfileId: string;
  flushPending: () => Promise<void>;
  setProfile: Update<Resume>;
  setContacts: Update<ProfileContact[]>;
  setContactId: Update<string | null>;
  setDefaultContactId: Update<string | null>;
  setMessage: Update<string>;
};
