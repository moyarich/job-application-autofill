import { Resume } from "@moyarich/resume";
import { ApplicationQnA } from "./application-q-n-a";

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

export type AnswerMap = Record<string, string>;

export interface AnswersResponse {
  answers?: AnswerMap;
  examples?: ApplicationQnA[];
  currentRecords?: ApplicationQnA[];
}
