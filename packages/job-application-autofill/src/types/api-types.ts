import { Resume } from "@moyarich/resume";

export type LocalProfile = { id: string; name: string; createdAt: string };
export type ResumeVersion = {
  id: string;
  name: string;
  contactId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ProfileContact = Resume["contact"] & {
  id: string;
  profileId: string;
  name: string;
  isDefault: boolean;
};
export type ContactChoice = "resume" | "shared" | "keep";
