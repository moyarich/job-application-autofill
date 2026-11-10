import type { RouteHandler } from "../types/types.ts";

import { generateResumePdf, parseResumeUpload } from "../services/resumes.ts";
import { reply } from "../server/reply.ts";

export const handleResumeProcessing: RouteHandler = async ({ req, url }) => {
  if (req.method === "POST" && url.pathname === "/api/resume/pdf") {
    const bytes = await generateResumePdf(await req.readJson());
    if (bytes.length > 10 * 1024 * 1024)
      return reply(413, {
        error: "Generated PDF exceeds the 10 MB attachment limit.",
      });
    return reply(200, { base64: Buffer.from(bytes).toString("base64") });
  }
  if (req.method === "POST" && url.pathname === "/api/resume/parse") {
    return reply(200, await parseResumeUpload(await req.readJson()));
  }
  return undefined;
};
