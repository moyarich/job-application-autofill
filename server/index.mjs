import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateResume } from "../resume-schema/validate.mjs";
import { renderResumePdf } from "../resume-schema/pdf.mjs";
import { openStore } from "./store.mjs";
import { decodePdfAttachment } from "../resume-schema/attachment.mjs";
import { prepareApplication, getApplication, getActiveApplication, continueApplication, answerApplicationQuestions, refreshScreenshot, submitApplication, closeApplication } from "./automation.mjs";

const PORT = Number(process.env.AUTOFILL_PORT || 4177);
const ORIGIN = process.env.AUTOFILL_ORIGIN || "http://localhost:5173";
const MAX_BODY = 15 * 1024 * 1024;
const store = openStore();
function send(res, code, data, contentType = "application/json") {
  res.writeHead(code, { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(contentType === "application/json" ? JSON.stringify(data) : data);
}
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("Request exceeds 15 MB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, { ok: true });
    if ((req.headers.origin && req.headers.origin !== ORIGIN) || req.headers["x-moya-client"] !== "dashboard")
      return send(res, 403, { error: "Only the local dashboard may access this API." });
    if (req.method === "GET" && url.pathname === "/api/state")
      return send(res, 200, store.getSnapshot());
    if (req.method === "PUT" && url.pathname === "/api/state") {
      const payload = await readJson(req);
      try { return send(res, 200, store.saveSnapshot(payload)); }
      catch (error) {
        if (error.code === "STALE_STATE") return send(res, 409, { error: error.message });
        throw error;
      }
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
      const { decodeUpload, extractProfile, extractResumeText } = await import("@moyarich/extract-resume");
      const upload = decodeUpload(await readJson(req));
      const text = await extractResumeText(upload.buffer, upload.extension);
      return send(res, 200, { profile: { ...extractProfile(text), source: { fileName: upload.fileName } },
        preview: text.slice(0, 3500), warnings: ["Review parsed fields before applying."] });
    }
    if (req.method === "GET" && url.pathname === "/api/apply/active")
      return send(res, 200, { session: getActiveApplication() });
    if (req.method === "POST" && url.pathname === "/api/apply/prepare") {
      const payload = await readJson(req);
      const profile = validateResume(payload.profile);
      const contact = profile.contact;
      if (!contact.firstName.trim() || !contact.lastName.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email))
        return send(res, 400, { error: "Complete first name, last name and valid email in the résumé JSON." });
      if (!payload.resume) return send(res, 400, { error: "A PDF resume attachment is required alongside the structured resume JSON." });
      const resume = decodePdfAttachment(payload.resume);
      return send(res, 200, await prepareApplication({ jobUrl: payload.jobUrl, jobId: payload.jobId, profile, resume }));
    }
    const match = url.pathname.match(/^\/api\/apply\/([0-9a-f-]+)(?:\/(submit|close|screenshot|snapshot|continue|answers))?$/);
    if (match) {
      const [, id, action] = match;
      if (req.method === "GET" && !action) return send(res, 200, getApplication(id));
      if (req.method === "POST" && action === "answers") {
        const payload = await readJson(req);
        return send(res, 200, await answerApplicationQuestions(id, payload.answers));
      }
      if (req.method === "POST" && action === "continue")
        return send(res, 200, await continueApplication(id));
      if (req.method === "POST" && action === "snapshot")
        return send(res, 200, await refreshScreenshot(id));
      if (req.method === "POST" && action === "submit") {
        const payload = await readJson(req);
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
