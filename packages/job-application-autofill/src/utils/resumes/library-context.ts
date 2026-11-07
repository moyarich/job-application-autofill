import type { Dispatch, SetStateAction } from "react";
import type { CandidateProfile } from "../../index";
import type { LocalProfile, ResumeVersion } from "../api/client";
type Update<T> = Dispatch<SetStateAction<T>>;
export type ProfileResumeActionsContext = {
  applicationId: string | null;
  applyBusy: boolean;
  sessionActive: boolean;
  activeProfileId: string;
  activeResumeId: string | null;
  pathname: string;
  profile: CandidateProfile;
  profiles: LocalProfile[];
  resumeVersions: ResumeVersion[];
  flushPending: () => Promise<void>;
  setMessage: Update<string>;
  setProfiles: Update<LocalProfile[]>;
  setResumeVersions: Update<ResumeVersion[]>;
};
