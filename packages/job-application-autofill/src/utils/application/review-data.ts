import type { JobApplication } from "../../index";
import type { ApplicationReviewActionsContext } from "./review-context";

/** Only the data/callbacks needed for application review, not a hook's return type. */
export type ApplicationReviewData = Pick<
  ApplicationReviewActionsContext,
  | "applicationId"
  | "activeProfileId"
  | "activeResumeId"
  | "profile"
  | "contactId"
  | "errors"
  | "setTab"
  | "setMessage"
> & {
  jobs: JobApplication[];
  hydrated: boolean;
  changeJob: ApplicationReviewActionsContext["changeJob"];
};
