import type { RouteHandler } from "../server/types.ts";
import { reply } from "../server/types.ts";
import { validateResume } from "../../../resume/src/resume-schema/validate.ts";
import { renderResumePdf } from "../../../resume/src/resume-schema/create-pdf.ts";
// Resume parse dependencies are dynamically imported on demand.

export const handleResumeProcessing: RouteHandler = async ({ req, url }) => {
    if (req.method === "POST" && url.pathname === "/api/resume/pdf") {
      const profile = validateResume(await req.readJson());
      const bytes = await renderResumePdf(profile);
      if (bytes.length > 10 * 1024 * 1024)
        return reply(413, {
          error: "Generated PDF exceeds the 10 MB attachment limit.",
        });
      return reply(200, { base64: Buffer.from(bytes).toString("base64") });
    }
    if (req.method === "POST" && url.pathname === "/api/resume/parse") {
      // Resume extraction is optional; JSON-only applicants never load its dependencies.
      const { decodeUpload, extractProfile, extractResumeText } =
        await import("@moyarich/resume");
      const upload = decodeUpload(await req.readJson());
      const text = await extractResumeText(upload.buffer, upload.extension);
      return reply(200, {
        profile: {
          ...extractProfile(text),
          source: { fileName: upload.fileName },
        },
        preview: text,
        warnings: ["Review parsed fields before applying."],
      });
    }
  return undefined;
};
