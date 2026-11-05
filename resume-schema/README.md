# job-application-autofill resume data contract

This directory defines the **canonical résumé JSON format**, independent of PDF/DOCX extraction.
Import any JSON file conforming to [resume.schema.json](resume.schema.json) in the dashboard under **Candidate profile → Import JSON**.
The user may fill it manually, export it from another tool, or generate it via the optional `@moyarich/extract-resume` parser.

The application API accepts the JSON as `profile` in `POST /api/apply/prepare`. A PDF or DOCX is **not required** to apply; attaching a resume remains an optional, separate action when the employer requests it.

Use the [example résumé](resume.example.json) as a starting point. The fields `contact`, `summary`, `experience`, `skills`, `education`, `projects`, `certifications`, `languages`, `awards` and `source` are the canonical contract; empty arrays are valid for sections with no information. No legacy flat-profile keys are accepted.

The `x-atsExportGuidance` annotation describes ATS-friendly *document rendering*, not parser requirements; JSON validation cannot guarantee that a PDF or DOCX has a readable layout or appropriate formatting.

## PDF export

Use the dashboard's **Export PDF** action after importing JSON or editing the résumé. The renderer is at [`pdf.mjs`](pdf.mjs); it accepts the canonical schema directly and does not load OCR, PDF/DOCX parsing, or optional extractor dependencies.

```js
import { renderResumePdf } from "./resume-schema/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const resume = JSON.parse(readFileSync("./resume-schema/resume.example.json", "utf8"));
writeFileSync("resume.pdf", renderResumePdf(resume));
```

The PDF is US Letter, one column, left aligned, with standard ATS headings, reverse-chronological employment, simple text bullets and automatic page breaks. It is **selectable text**, not an image or browser print screenshot.

**Limitations:** This minimal dependency-free exporter uses built-in PDF Latin fonts. Common résumé bullets (including ●, •, ▪ and ◆), smart punctuation and check marks are normalized to ATS-readable ASCII equivalents before encoding. For names or content requiring other non-Latin Unicode, it reports an error rather than silently corrupting characters. Visual formatting and employer-specific ATS import behavior still need review.
