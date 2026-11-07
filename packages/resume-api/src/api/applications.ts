import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateResume } from "../../../resume/src/resume-schema/validate.ts";
import { employerAccountIdentity } from "../../../job-sites/employer-account.ts";
import { decodePdfAttachment } from "../../../resume/src/resume-schema/attachment.ts";
import {
  prepareApplication,
  pasteApplicationText,
  getApplication,
  getApplicationMenu,
  runApplicationMenuItem,
  getActiveApplication,
  continueApplication,
  answerApplicationQuestions,
  refreshScreenshot,
  submitApplication,
  prepareApplicationAccount,
  closeApplication,
} from "../../../job-sites/automation.ts";

export const handleApplications: RouteHandler = async ({ req, url, store, profileId, resumeIdHeader }) => {
    function accountForJob(jobId: string) {
      const job = store
        .getSnapshot(profileId)
        .jobs.find((item) => item.id === jobId);
      if (!job) return null;
      const identity = employerAccountIdentity(job.url, job.company);
      return identity
        ? (store
            .listAccounts(profileId)
            .find(
              (account) =>
                account.provider === identity.provider &&
                account.employerKey === identity.employerKey,
            ) ?? null)
        : null;
    }
    if (req.method === "GET" && url.pathname === "/api/apply/active") {
      const active = getActiveApplication(
        url.searchParams.get("jobId"),
        profileId,
      );
      return reply(200, {
        session: active
          ? { ...active, employerAccount: accountForJob(active.jobId) }
          : null,
      });
    }
    if (req.method === "POST" && url.pathname === "/api/apply/prepare") {
      const payload = record(await req.readJson());
      const savedJob = store
        .getSnapshot(profileId, resumeIdHeader)
        .jobs.find((job) => job.id === payload.jobId);
      if (!savedJob || savedJob.url !== payload.jobUrl)
        throw new Error("Application does not belong to the selected profile.");
      const profile = validateResume(payload.profile);
      const contact = profile.contact;
      if (
        !contact.firstName.trim() ||
        !contact.lastName.trim() ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)
      )
        return reply(400, {
          error:
            "Complete first name, last name and valid email in the resume JSON.",
        });
      if (!payload.resume)
        return reply(400, {
          error:
            "A PDF resume attachment is required alongside the structured resume JSON.",
        });
      const attachment = record(payload.resume);
      if (
        typeof attachment.fileName !== "string" ||
        typeof attachment.base64 !== "string"
      )
        throw new Error("Invalid resume attachment.");
      const resume = decodePdfAttachment({
        fileName: attachment.fileName,
        base64: attachment.base64,
      });
      if (
        typeof payload.jobUrl !== "string" ||
        typeof payload.jobId !== "string"
      )
        throw new Error("Invalid application identifiers.");
      const accountIdentity = employerAccountIdentity(
        savedJob.url,
        savedJob.company,
      );
      const employerAccount = accountIdentity
        ? store.getOrCreateEmployerAccount(profileId, accountIdentity)
        : null;
      const prepared = await prepareApplication({
        jobUrl: payload.jobUrl,
        jobId: payload.jobId,
        profileId,
        profile,
        resume,
        company: savedJob.company,
        accountSetupRequired: employerAccount?.status === "setup_required",
      });
      return reply(200, { ...prepared, employerAccount });
    }
    const match = url.pathname.match(
      /^\/api\/apply\/([0-9a-f-]+)(?:\/(submit|close|screenshot|snapshot|continue|answers|account-signup|focus|paste|menu))?$/,
    );
    if (match) {
      const [, id, action] = match;
      if (getApplication(id).profileId !== profileId)
        throw new Error(
          "Application session belongs to another local profile.",
        );
      if (req.method === "GET" && !action)
        return reply(200, {
          ...getApplication(id),
          employerAccount: accountForJob(getApplication(id).jobId),
        });
      if (req.method === "GET" && action === "menu")
        return reply(200, { items: await getApplicationMenu(id) });
      if (req.method === "POST" && action === "menu") {
        const payload = record(await req.readJson());
        if (typeof payload.itemId !== "string")
          throw new Error("Invalid job-site menu item.");
        return reply(200, await runApplicationMenuItem(id, payload.itemId));
      }
      if (req.method === "POST" && action === "account-signup") {
        const body = record(await req.readJson());
        if (body.password != null && typeof body.password !== "string")
          throw new Error("Invalid account password.");
        const job = store
          .getSnapshot(profileId)
          .jobs.find((item) => item.id === getApplication(id).jobId);
        if (!job) throw new Error("Job does not belong to this profile.");
        const updated = await prepareApplicationAccount(
          id,
          job.company,
          body.password as string | undefined,
        );
        const identity = employerAccountIdentity(job.url, job.company);
        return reply(200, {
          ...updated,
          employerAccount: identity
            ? store.getOrCreateEmployerAccount(profileId, identity)
            : null,
        });
      }
      if (req.method === "POST" && action === "answers") {
        const payload = record(await req.readJson());
        return reply(200,
          await answerApplicationQuestions(
            id,
            record(payload.answers) as Record<string, string>,
          ),
        );
      }
      if (req.method === "POST" && action === "continue")
        return reply(200,
          await continueApplication(
            id,
            store.getSnapshot(profileId, resumeIdHeader).profile ?? undefined,
          ),
        );
      if (req.method === "POST" && action === "paste") {
        const body = record(await req.readJson());
        return reply(200, await pasteApplicationText(id, body.text));
      }
      if (req.method === "POST" && action === "focus")
        return reply(200, await refreshScreenshot(id, { focus: true }));
      if (req.method === "POST" && action === "snapshot")
        return reply(200, await refreshScreenshot(id));
      if (req.method === "POST" && action === "submit") {
        const payload = record(await req.readJson());
        if (
          payload.confirm !== true ||
          (process.env.CONTAINER_MODE === "true" && payload.reviewed !== true)
        )
          return reply(400, {
            error:
              "Confirm submission and acknowledge reviewing the browser first.",
          });
        return reply(200, await submitApplication(id));
      }
      if (req.method === "POST" && action === "close") {
        await closeApplication(id);
        return reply(200, { closed: true });
      }
      if (req.method === "GET" && action === "screenshot") {
        getApplication(id); // Verify session exists.
        const file = await readFile(resolve("screenshots", id + ".png"));
        return reply(200, file, "image/png");
      }
    }
  return undefined;
};
