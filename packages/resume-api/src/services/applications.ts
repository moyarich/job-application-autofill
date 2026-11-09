import type { Store } from "../server/types.ts";
import { validateResume } from "../../../resume/src/resume-schema/validate.ts";
import { decodePdfAttachment } from "../../../resume/src/resume-schema/attachment.ts";
import { employerAccountIdentity } from "../../../job-sites/employer-account.ts";
import { prepareApplication } from "../../../job-sites/automation.ts";

export function accountForJob(store: Store, profileId: string, jobId: string) {
  const job = store.getJobList(profileId).jobs.find(item => item.id === jobId);
  if (!job) return null;
  const identity = employerAccountIdentity(job.url, job.company);
  return identity
    ? store.listAccounts(profileId).find(account =>
        account.provider === identity.provider && account.employerKey === identity.employerKey) ?? null
    : null;
}

export type PrepareResult =
  | { ok: false; error: string }
  | { ok: true; data: Awaited<ReturnType<typeof prepareApplication>> & { employerAccount: ReturnType<Store["getOrCreateEmployerAccount"]> | null } };

export async function prepareSavedApplication(
  store: Store,
  profileId: string,
  resumeId: string | undefined,
  payload: Record<string, unknown>,
): Promise<PrepareResult> {
  const savedJob = store.getJobList(profileId).jobs.find(job => job.id === payload.jobId);
  if (!savedJob || savedJob.url !== payload.jobUrl)
    throw new Error("Application does not belong to the selected profile.");
  if (savedJob.resumeId && savedJob.resumeId !== resumeId)
    throw new Error("The selected resume does not match this application. Reopen it with the assigned resume.");
  const profile = validateResume(payload.profile);
  const contact = profile.contact;
  if (!contact.firstName.trim() || !contact.lastName.trim() ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email))
    return { ok: false, error: "Complete first name, last name and valid email in the resume JSON." };
  if (!payload.resume)
    return { ok: false, error: "A PDF resume attachment is required alongside the structured resume JSON." };
  if (typeof payload.resume !== "object" || Array.isArray(payload.resume))
    throw new Error("Expected a JSON object.");
  const attachment = payload.resume as Record<string, unknown>;
  if (typeof attachment.fileName !== "string" || typeof attachment.base64 !== "string")
    throw new Error("Invalid resume attachment.");
  const resume = decodePdfAttachment({ fileName: attachment.fileName, base64: attachment.base64 });
  if (typeof payload.jobUrl !== "string" || typeof payload.jobId !== "string")
    throw new Error("Invalid application identifiers.");
  const identity = employerAccountIdentity(savedJob.url, savedJob.company);
  const employerAccount = identity ? store.getOrCreateEmployerAccount(profileId, identity) : null;
  const prepared = await prepareApplication({
    jobUrl: payload.jobUrl, jobId: payload.jobId, profileId, profile, resume,
    company: savedJob.company,
    accountSetupRequired: employerAccount?.status === "setup_required",
  });
  return { ok: true, data: { ...prepared, employerAccount } };
}
