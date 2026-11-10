import { Resume } from "@moyarich/resume";
import type { Dispatch, SetStateAction } from "react";
import { LocalProfile, ResumeVersion } from "./api-types";

type Update<T> = Dispatch<SetStateAction<T>>;
export type ProfileResumeActionsContext = {
  applicationId: string | null;
  applyBusy: boolean;
  sessionActive: boolean;
  activeProfileId: string;
  activeResumeId: string | null;
  pathname: string;
  profile?: Resume;
  profiles: LocalProfile[];
  resumeVersions: ResumeVersion[];
  flushPending: () => Promise<void>;
  setMessage: Update<string>;
  setProfiles: Update<LocalProfile[]>;
  setResumeVersions: Update<ResumeVersion[]>;
};
