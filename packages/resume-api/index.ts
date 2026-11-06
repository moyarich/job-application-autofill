import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateResume } from "../resume/src/resume-schema/validate.ts";
import { renderResumePdf } from "../resume/src/resume-schema/create-pdf.ts";
import { openStore, DEFAULT_PROFILE_ID } from "./store.ts";
import { decodePdfAttachment } from "../resume/src/resume-schema/attachment.ts";
import { prepareApplication, getApplication, getActiveApplication, continueApplication, answerApplicationQuestions, refreshScreenshot, submitApplication, closeApplication } from "../job-sites/automation.ts";

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
    if (req.method === "GET" && url.pathname === "/api/state")
      return send(res, 200, store.getSnapshot(profileId));
    if (req.method === "PUT" && url.pathname === "/api/state") {
      const payload = await readJson(req);
      try { return send(res, 200, store.saveSnapshot(payload, profileId)); }
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
      return send(res, 200, store.saveSnapshot(snapshot, profileId));
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
    if (req.method === "GET" && url.pathname === "/api/apply/active")
      return send(res, 200, { session: getActiveApplication(url.searchParams.get("jobId")) });
    if (req.method === "POST" && url.pathname === "/api/apply/prepare") {
      const payload = record(await readJson(req));
      const profile = validateResume(payload.profile);
      const contact = profile.contact;
      if (!contact.firstName.trim() || !contact.lastName.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email))
        return send(res, 400, { error: "Complete first name, last name and valid email in the résumé JSON." });
      if (!payload.resume) return send(res, 400, { error: "A PDF resume attachment is required alongside the structured resume JSON." });
      const attachment = record(payload.resume);
      if (typeof attachment.fileName !== "string" || typeof attachment.base64 !== "string") throw new Error("Invalid resume attachment.");
      const resume = decodePdfAttachment({ fileName: attachment.fileName, base64: attachment.base64 });
      if (typeof payload.jobUrl !== "string" || typeof payload.jobId !== "string") throw new Error("Invalid application identifiers.");
      return send(res, 200, await prepareApplication({ jobUrl: payload.jobUrl, jobId: payload.jobId, profile, resume }));
    }
    const match = url.pathname.match(/^\/api\/apply\/([0-9a-f-]+)(?:\/(submit|close|screenshot|snapshot|continue|answers|focus))?$/);
    if (match) {
      const [, id, action] = match;
      if (req.method === "GET" && !action) return send(res, 200, getApplication(id));
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
