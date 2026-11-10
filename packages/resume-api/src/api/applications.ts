import {
  accountForJob,
  prepareSavedApplication,
} from "../services/applications.ts";
import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { employerAccountIdentity } from "../../../job-sites/employer-account.ts";
import {
  pasteApplicationText,
  getApplication,
  getApplicationMenu,
  runApplicationMenuItem,
  getActiveApplication,
  continueApplication,
  answerApplicationQuestions,
  snapshotEmployerAnswers,
  refreshScreenshot,
  submitApplication,
  prepareApplicationAccount,
  closeApplication,
} from "../../../job-sites/automation.ts";

export const handleApplications: RouteHandler = async ({
  req,
  url,
  store,
  profileId,
  resumeIdHeader,
}) => {
  const savedAnswers = url.pathname.match(/^\/api\/applications\/([0-9a-f-]+)\/answers$/);
  if (savedAnswers && req.method === "GET")
    return reply(200, { answers: store.listApplicationAnswers(profileId, savedAnswers[1]) });
  if (req.method === "GET" && url.pathname === "/api/apply/active") {
    const active = getActiveApplication(
      url.searchParams.get("jobId"),
      profileId,
    );
    return reply(200, {
      session: active
        ? {
            ...active,
            employerAccount: accountForJob(store, profileId, active.jobId),
          }
        : null,
    });
  }
  if (req.method === "POST" && url.pathname === "/api/apply/prepare") {
    const result = await prepareSavedApplication(
      store,
      profileId,
      resumeIdHeader,
      record(await req.readJson()),
    );
    return result.ok
      ? reply(200, result.data)
      : reply(400, { error: result.error });
  }
  const match = url.pathname.match(
    /^\/api\/apply\/([0-9a-f-]+)(?:\/(submit|close|screenshot|snapshot|save-answers|continue|answers|account-signup|focus|paste|menu))?$/,
  );
  if (match) {
    const [, id, action] = match;
    if (getApplication(id).profileId !== profileId)
      throw new Error("Application session belongs to another local profile.");
    if (req.method === "GET" && !action)
      return reply(200, {
        ...getApplication(id),
        employerAccount: accountForJob(
          store,
          profileId,
          getApplication(id).jobId,
        ),
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
        .getJobList(profileId)
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
    if (req.method === "GET" && action === "save-answers")
      return reply(200, { answers: store.listApplicationAnswers(profileId, getApplication(id).jobId) });
    if (req.method === "POST" && action === "save-answers") {
      const captured = await snapshotEmployerAnswers(id);
      const answers = store.saveApplicationAnswers(profileId, getApplication(id).jobId, captured);
      return reply(200, { answers, count: Object.keys(captured).length });
    }
    if (req.method === "POST" && action === "answers") {
      const payload = record(await req.readJson());
      return reply(
        200,
        await answerApplicationQuestions(
          id,
          record(payload.answers) as Record<string, string>,
        ),
      );
    }
    if (req.method === "POST" && action === "continue")
      return reply(
        200,
        await continueApplication(
          id,
          store.getResumeContent(profileId, resumeIdHeader).profile ??
            undefined,
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
