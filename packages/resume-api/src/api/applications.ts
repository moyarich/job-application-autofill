import {
  accountForJob,
  prepareSavedApplication,
} from "../services/applications.ts";
import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { employerAccountIdentity } from "@moyarich/job-boards/employer-account";
import {
  pasteApplicationText,
  getApplication,
  refreshApplicationState,
  getApplicationMenu,
  runApplicationMenuItem,
  getActiveApplication,
  continueApplication,
  pauseApplication,
  answerApplicationQuestions,
  snapshotEmployerAnswers,
  refreshScreenshot,
  submitApplication,
  prepareApplicationAccount,
  closeApplication,
} from "@moyarich/job-boards/automation";

export const handleApplications: RouteHandler = async ({
  req,
  url,
  store,
  profileId,
  resumeIdHeader,
}) => {
  const savedAnswers = url.pathname.match(/^\/api\/applications\/([0-9a-f-]+)\/answers$/);
  if (savedAnswers && req.method === "GET")
    return reply(200, store.getApplicationAnswerContext(profileId, savedAnswers[1]));
  if (savedAnswers && req.method === "POST") {
    const payload = record(await req.readJson());
    if (typeof payload.question !== "string" || typeof payload.answer !== "string")
      throw new Error("Question and answer are required.");
    // New library records are attached to this application, never an invented global owner.
    return reply(201, store.createApplicationAnswer(profileId, savedAnswers[1], payload.question, payload.answer));
  }
  const answerRecord = url.pathname.match(/^\/api\/applications\/([0-9a-f-]+)\/answers\/record$/);
  if (answerRecord && (req.method === "PATCH" || req.method === "DELETE")) {
    const payload = record(await req.readJson());
    const { applicationId, question, expectedAnswer, expectedUpdatedAt, answer } = payload;
    if (typeof applicationId !== "string" || typeof question !== "string" ||
        typeof expectedAnswer !== "string" || typeof expectedUpdatedAt !== "string")
      throw new Error("Invalid answer reference.");
    // Validate the viewed application even when updating a different source in the same profile.
    store.listApplicationAnswers(profileId, answerRecord[1]);
    if (req.method === "DELETE")
      return reply(200, store.deleteApplicationAnswer(profileId, applicationId, question, expectedAnswer, expectedUpdatedAt));
    if (typeof answer !== "string") throw new Error("Answer is required.");
    return reply(200, store.updateApplicationAnswer(profileId, applicationId, question, expectedAnswer, expectedUpdatedAt, answer));
  }
  if (req.method === "GET" && url.pathname === "/api/apply/active") {
    const active = getActiveApplication(
      url.searchParams.get("jobId"),
      profileId,
    );
    return reply(200, {
      session: active
        ? {
            ...await refreshApplicationState(active.id),
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
    /^\/api\/apply\/([0-9a-f-]+)(?:\/(submit|close|screenshot|snapshot|save-answers|continue|pause|answers|account-signup|focus|paste|menu))?$/,
  );
  if (match) {
    const [, id, action] = match;
    if (getApplication(id).profileId !== profileId)
      throw new Error("Application session belongs to another local profile.");
    if (req.method === "GET" && !action)
      return reply(200, {
        ...await refreshApplicationState(id),
        employerAccount: accountForJob(
          store,
          profileId,
          getApplication(id).jobId,
        ),
      });
    if (req.method === "GET" && action === "menu") {
      const session = await refreshApplicationState(id);
      return reply(200, { items: await getApplicationMenu(id), session });
    }
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
    if (req.method === "POST" && action === "pause")
      return reply(200, pauseApplication(id));
    if (req.method === "POST" && action === "continue") {
      // Capture answers on the current step before automation moves forward.
      const captured = await snapshotEmployerAnswers(id).catch(() => ({}));
      if (Object.keys(captured).length)
        store.saveApplicationAnswers(profileId, getApplication(id).jobId, captured);
      return reply(
        200,
        await continueApplication(
          id,
          resumeIdHeader
            ? (store.getResumeContent(profileId, resumeIdHeader).profile ?? undefined)
            : undefined,
        ),
      );
    }
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
      const captured = await snapshotEmployerAnswers(id).catch(() => ({}));
      if (Object.keys(captured).length)
        store.saveApplicationAnswers(profileId, getApplication(id).jobId, captured);
      const result = await submitApplication(id);
      store.setJobStatus(profileId, result.jobId,
        result.state === "submitted" ? "submitted" : "in_progress");
      return reply(200, result);
    }
    if (req.method === "POST" && action === "close") {
      const captured = await snapshotEmployerAnswers(id).catch(() => ({}));
      if (Object.keys(captured).length)
        store.saveApplicationAnswers(profileId, getApplication(id).jobId, captured);
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
