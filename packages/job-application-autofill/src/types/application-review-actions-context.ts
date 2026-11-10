import type { Dispatch, SetStateAction } from "react";

import type { ApplySession } from "./types";
import { Resume } from "@moyarich/resume";
import { ApplicationStatus } from "./job-application";
type Update<T> = Dispatch<SetStateAction<T>>;
export type ApplicationReviewActionsContext = {
  applicationId: string | null;
  activeProfileId: string;
  activeResumeId: string | null;
  profile: Resume;
  contactId: string | null;
  errors: string[];
  session: ApplySession | null;
  reviewed: boolean;
  setTab: (next: "profile") => void;
  changeJob: (id: string, status: ApplicationStatus) => void;
  setMessage: Update<string>;
  setApplyBusy: Update<boolean>;
  setSession: Update<ApplySession | null>;
  setReviewed: Update<boolean>;
};
