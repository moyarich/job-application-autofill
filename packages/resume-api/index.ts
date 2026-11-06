import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateResume } from "../resume/src/resume-schema/validate.ts";
import { renderResumePdf } from "../resume/src/resume-schema/create-pdf.ts";
import { openStore, DEFAULT_PROFILE_ID } from "./store.ts";
import { employerAccountIdentity } from "../job-sites/employer-account.ts";
import { decodePdfAttachment } from "../resume/src/resume-schema/attachment.ts";
import { prepareApplication, getApplication, getActiveApplication, continueApplication, answerApplicationQuestions, refreshScreenshot, submitApplication, prepareApplicationAccount, closeApplication } from "../job-sites/automation.ts";

// Local host development loads .env; Compose supplies the same keys as server environment.
try { process.loadEnvFile(resolve(import.meta.dirname, "../../.env")); }
catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }

const PORT = Number(process.env.AUTOFILL_PORT || 4177);
const ORIGIN = process.env.AUTOFILL_ORIGIN || "http://localhost:5173";
const MAX_BODY = 15 * 1024 * 1024;
const store = openStore();
function send(res: ServerResponse, code: number, data: unknown, contentType = "application/json") {
  res.writeHead(code, { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  const body = contentType === "application/json" ? JSON.stringify(data) : data;
  if (typeof body !== "string" && !Buffer.isBuffer(body)) throw new Error("Unsupported response body.");
  res.end(body);
}
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Request exceeds 15 MB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object.");
  return value as Record<string, unknown>;
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, { ok: true });
    if ((req.headers.origin && req.headers.origin !== ORIGIN) || req.headers["x-moya-client"] !== "dashboard")
      return send(res, 403, { error: "Only the local dashboard may access this API." });
    if (req.method === "GET" && url.pathname === "/api/viewer/config") {
      if (!process.env.WEB_VNC_PASSWORD) throw new Error("WEB_VNC_PASSWORD is not configured.");
      return send(res, 200, { password: process.env.WEB_VNC_PASSWORD });
    }
    const profileIdHeader = req.headers["x-profile-id"];
    if (Array.isArray(profileIdHeader)) throw new Error("Multiple profile IDs are not allowed.");
    const profileId = profileIdHeader ?? DEFAULT_PROFILE_ID;
    const resumeIdHeader = req.headers["x-resume-id"];
    if (Array.isArray(resumeIdHeader)) throw new Error("Multiple resume IDs are not allowed.");
    if (req.method === "GET" && url.pathname === "/api/profiles")
      return send(res, 200, { profiles: store.listProfiles(), defaultProfileId: DEFAULT_PROFILE_ID });
    if (req.method === "POST" && url.pathname === "/api/profiles") {
      const payload = record(await readJson(req));
      return send(res, 201, store.createProfile(payload.name));
    }
    const profileRoute = url.pathname.match(/^\/api\/profiles\/([0-9a-f-]{36})$/i);
    if (profileRoute && req.method === "PATCH") {
      const payload = record(await readJson(req));
      return send(res, 200, store.renameProfile(profileRoute[1], payload.name));
    }
    if (profileRoute && req.method === "DELETE") {
      store.deleteProfile(profileRoute[1]);
      return send(res, 200, { deleted: true });
    }
    if (req.method === "GET" && url.pathname === "/api/employer-accounts")
      return send(res, 200, { accounts: store.listAccounts(profileId) });
    if (req.method === "POST" && url.pathname === "/api/employer-accounts/status") {
      const payload = record(await readJson(req));
      if (typeof payload.jobId !== "string" || typeof payload.status !== "string")
        throw new Error("A job ID and account status are required.");
      if (payload.status !== "ready" && payload.status !== "setup_required")
        throw new Error("Invalid employer account status.");
      const job = store.getSnapshot(profileId).jobs.find(item => item.id === payload.jobId);
      if (!job) throw new Error("Job does not belong to the selected local profile.");
      const identity = employerAccountIdentity(job.url, job.company);
      if (!identity) throw new Error("Employer account cannot be identified.");
      store.getOrCreateEmployerAccount(profileId, identity);
      return send(res, 200, store.setEmployerAccountStatus(profileId, identity.provider, identity.employerKey, payload.status));
    }
    if (req.method === "GET" && url.pathname === "/api/profile-contacts")
      return send(res, 200, { contacts: store.listContacts(profileId) });
    if (req.method === "POST" && url.pathname === "/api/profile-contacts") {
      const payload = record(await readJson(req));
      return send(res, 201, store.createContact(profileId,payload.contact,payload.name));
    }
    if (req.method === "POST" && url.pathname === "/api/profile-contacts/import") {
      const payload = record(await readJson(req));
      if (typeof payload.resumeId !== "string") throw new Error("Resume ID required.");
      return send(res, 200, store.resolveImportContact(profileId,payload.resumeId,payload.contact,payload.choices));
    }
    const contactRoute = url.pathname.match(/^\/api\/profile-contacts\/([0-9a-f-]{36})$/i);
    if (contactRoute && req.method === "PATCH") {
      const payload = record(await readJson(req));
      return send(res, 200, store.updateContactRecord(profileId,contactRoute[1],payload.contact));
    }
    const defaultContactRoute = url.pathname.match(/^\/api\/profile-contacts\/([0-9a-f-]{36})\/default$/i);
    if (defaultContactRoute && req.method === "POST")
      return send(res, 200, store.setDefaultContact(profileId,defaultContactRoute[1]));
    if (req.method === "GET" && url.pathname === "/api/resumes")
      return send(res, 200, { resumes: store.listResumes(profileId) });
    if (req.method === "POST" && url.pathname === "/api/resumes") {
      const payload = record(await readJson(req));
      if (payload.copyId != null && typeof payload.copyId !== "string") throw new Error("Invalid source resume ID.");
      return send(res, 201, store.createResume(profileId, payload.name, payload.copyId as string | undefined));
    }
    const resumeRoute = url.pathname.match(/^\/api\/resumes\/([0-9a-f-]{36})$/i);
    if (resumeRoute && req.method === "PATCH") {
      const payload = record(await readJson(req));
      return send(res, 200, store.renameResume(profileId, resumeRoute[1], payload.name));
    }
    if (resumeRoute && req.method === "DELETE") {
      store.deleteResume(profileId, resumeRoute[1]);
      return send(res, 200, { deleted: true });
    }
    if (req.method === "GET" && url.pathname === "/api/state")
      return send(res, 200, store.getSnapshot(profileId, resumeIdHeader));
    if (req.method === "PUT" && url.pathname === "/api/state") {
      const payload = await readJson(req);
      try { return send(res, 200, store.saveSnapshot(payload, profileId, resumeIdHeader)); }
      catch (error) {
        if (error instanceof Error && "code" in error && error.code === "STALE_STATE") return send(res, 409, { error: error.message });
        throw error;
      }
    }
    const jobStatus = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})\/status$/);
    if (req.method === "POST" && jobStatus) {
      const { status } = record(await readJson(req));
      if (typeof status !== "string") throw new Error("Application status must be a string.");
      const snapshot = store.getSnapshot(profileId);
      if (!snapshot.jobs.some(job => job.id === jobStatus[1])) throw new Error("Application not found.");
      snapshot.jobs = snapshot.jobs.map(job => job.id === jobStatus[1] ? {...job, status} : job);
      return send(res, 200, store.saveSnapshot(snapshot, profileId, resumeIdHeader));
    }
    if (req.method === "POST" && url.pathname === "/api/resume/pdf") {
      const profile = validateResume(await readJson(req));
      const bytes = await renderResumePdf(profile);
      if (bytes.length > 10 * 1024 * 1024)
        return send(res, 413, { error: "Generated PDF exceeds the 10 MB attachment limit." });
      return send(res, 200, { base64: Buffer.from(bytes).toString("base64") });
    }
    if (req.method === "POST" && url.pathname === "/api/resume/parse") {
      // Resume extraction is optional; JSON-only applicants never load its dependencies.
      const { decodeUpload, extractProfile, extractResumeText } = await import("@moyarich/resume");
      const upload = decodeUpload(await readJson(req));
      const text = await extractResumeText(upload.buffer, upload.extension);
      return send(res, 200, { profile: { ...extractProfile(text), source: { fileName: upload.fileName } },
        preview: text, warnings: ["Review parsed fields before applying."] });
    }
    function accountForJob(jobId: string) {
      const job = store.getSnapshot(profileId).jobs.find(item => item.id === jobId);
      if (!job) return null;
      const identity = employerAccountIdentity(job.url, job.company);
      return identity ? store.listAccounts(profileId).find(account => account.provider === identity.provider &&
        account.employerKey === identity.employerKey) ?? null : null;
    }
    if (req.method === "GET" && url.pathname === "/api/apply/active") {
      const active = getActiveApplication(url.searchParams.get("jobId"), profileId);
      return send(res, 200, { session: active ? { ...active, employerAccount: accountForJob(active.jobId) } : null });
    }
    if (req.method === "POST" && url.pathname === "/api/apply/prepare") {
      const payload = record(await readJson(req));
      const savedJob = store.getSnapshot(profileId, resumeIdHeader).jobs.find(job => job.id === payload.jobId);
      if (!savedJob || savedJob.url !== payload.jobUrl) throw new Error("Application does not belong to the selected profile.");
      const profile = validateResume(payload.profile);
      const contact = profile.contact;
      if (!contact.firstName.trim() || !contact.lastName.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email))
        return send(res, 400, { error: "Complete first name, last name and valid email in the resume JSON." });
      if (!payload.resume) return send(res, 400, { error: "A PDF resume attachment is required alongside the structured resume JSON." });
      const attachment = record(payload.resume);
      if (typeof attachment.fileName !== "string" || typeof attachment.base64 !== "string") throw new Error("Invalid resume attachment.");
      const resume = decodePdfAttachment({ fileName: attachment.fileName, base64: attachment.base64 });
      if (typeof payload.jobUrl !== "string" || typeof payload.jobId !== "string") throw new Error("Invalid application identifiers.");
      const accountIdentity = employerAccountIdentity(savedJob.url, savedJob.company);
      const employerAccount = accountIdentity ? store.getOrCreateEmployerAccount(profileId, accountIdentity) : null;
      const prepared = await prepareApplication({ jobUrl: payload.jobUrl, jobId: payload.jobId, profileId, profile, resume, company: savedJob.company, accountSetupRequired: employerAccount?.status === "setup_required" });
      return send(res, 200, { ...prepared, employerAccount });
    }
    const match = url.pathname.match(/^\/api\/apply\/([0-9a-f-]+)(?:\/(submit|close|screenshot|snapshot|continue|answers|account-signup|focus))?$/);
    if (match) {
      const [, id, action] = match;
      if (getApplication(id).profileId !== profileId) throw new Error("Application session belongs to another local profile.");
      if (req.method === "GET" && !action) return send(res, 200, { ...getApplication(id), employerAccount: accountForJob(getApplication(id).jobId) });
      if (req.method === "POST" && action === "account-signup") {
        const body = record(await readJson(req));
        if (body.password != null && typeof body.password !== "string")
          throw new Error("Invalid account password.");
        const job = store.getSnapshot(profileId).jobs.find(item => item.id === getApplication(id).jobId);
        if (!job) throw new Error("Job does not belong to this profile.");
        const updated = await prepareApplicationAccount(id, job.company, body.password as string | undefined);
        const identity = employerAccountIdentity(job.url, job.company);
        return send(res, 200, { ...updated, employerAccount: identity
          ? store.getOrCreateEmployerAccount(profileId, identity) : null });
      }
      if (req.method === "POST" && action === "answers") {
        const payload = record(await readJson(req));
        return send(res, 200, await answerApplicationQuestions(id, record(payload.answers) as Record<string, string>));
      }
      if (req.method === "POST" && action === "continue")
        return send(res, 200, await continueApplication(id));
      if (req.method === "POST" && action === "focus")
        return send(res, 200, await refreshScreenshot(id, { focus: true }));
      if (req.method === "POST" && action === "snapshot")
        return send(res, 200, await refreshScreenshot(id));
      if (req.method === "POST" && action === "submit") {
        const payload = record(await readJson(req));
        if (payload.confirm !== true || (process.env.CONTAINER_MODE === "true" && payload.reviewed !== true))
          return send(res, 400, { error: "Confirm submission and acknowledge reviewing the browser first." });
        return send(res, 200, await submitApplication(id));
      }
      if (req.method === "POST" && action === "close") {
        await closeApplication(id); return send(res, 200, { closed: true });
      }
      if (req.method === "GET" && action === "screenshot") {
        getApplication(id); // Verify session exists.
        const file = await readFile(resolve("screenshots", id + ".png"));
        return send(res, 200, file, "image/png");
      }
    }
    return send(res, 404, { error: "Unknown API route." });
  } catch (error) {
    console.error(error);
    return send(res, 400, { error: error instanceof Error ? error.message : "Request failed" });
  }
});
const HOST = process.env.AUTOFILL_HOST || "127.0.0.1";
server.listen(PORT, HOST, () => console.log("job-application-autofill local API listening on " + HOST + ":" + PORT));
