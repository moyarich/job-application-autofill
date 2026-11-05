import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { decodeUpload, extractProfile, extractResumeText } from "@moyarich/extract-resume";
import { prepareApplication, getApplication, submitApplication, closeApplication } from "./automation.mjs";

const PORT = Number(process.env.AUTOFILL_PORT || 4177);
const ORIGIN = process.env.AUTOFILL_ORIGIN || "http://localhost:5173";
const MAX_BODY = 15 * 1024 * 1024;
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
    if (req.headers.origin !== ORIGIN || req.headers["x-moya-client"] !== "dashboard")
      return send(res, 403, { error: "Only the local dashboard may access this API." });
    if (req.method === "POST" && url.pathname === "/api/resume/parse") {
      const upload = decodeUpload(await readJson(req));
      const text = await extractResumeText(upload.buffer, upload.extension);
      return send(res, 200, { profile: { ...extractProfile(text), resumeFileName: upload.fileName },
        preview: text.slice(0, 3500), warnings: ["Review parsed fields before applying."] });
    }
    if (req.method === "POST" && url.pathname === "/api/apply/prepare") {
      const payload = await readJson(req);
      const profile = payload.profile;
      if (!profile || typeof profile !== "object" || !profile.firstName || !profile.lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email || ""))
        return send(res, 400, { error: "Complete the candidate profile before applying." });
      const resume = payload.resume ? decodeUpload(payload.resume) : null;
      return send(res, 200, await prepareApplication({ jobUrl: payload.jobUrl, profile, resume }));
    }
    const match = url.pathname.match(/^\/api\/apply\/([0-9a-f-]+)(?:\/(submit|close|screenshot))?$/);
    if (match) {
      const [, id, action] = match;
      if (req.method === "GET" && !action) return send(res, 200, getApplication(id));
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
server.listen(PORT, HOST, () => console.log("MoyaApply local API listening on " + HOST + ":" + PORT));
