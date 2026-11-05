# job-application-autofill resume data contract

This directory defines the canonical résumé JSON format, independent of PDF/DOCX extraction.
Import a conforming JSON file under **Candidate profile → Import JSON**.
The application API accepts JSON as `profile` in `POST /api/apply/prepare`; a PDF attachment is generated for job submissions when no PDF is uploaded.

## Unicode PDF export

PDF export is handled by **Chromium's print engine**, with embedded fonts and script-aware shaping. The legacy built-in PDF Latin encoder has been removed. Unicode text is preserved exactly, including bullets, accented names, CJK, Arabic, Devanagari and emoji when supported by the installed font. There is no transliteration or character substitution.

The Docker image installs Noto Sans families (including CJK and emoji) for broad script coverage. Rendering and text extraction depend on actual installed fonts and glyph support; Unicode code points without a matching font glyph cannot be guaranteed to display. Review output before submitting to an ATS.

From the local dashboard choose **Export PDF**. The dashboard sends validated canonical JSON to `POST /api/resume/pdf` and downloads the returned PDF. Automatically generated attachments during job applications use the same endpoint. The API requires the local dashboard header and allowed origin, as do other routes.

Server-side usage:

```js
import { renderResumePdf } from "./resume-schema/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const resume = JSON.parse(readFileSync("./resume-schema/resume.example.json", "utf8"));
writeFileSync("resume.pdf", await renderResumePdf(resume));
```

The renderer is asynchronous because it launches a fresh headless Chromium instance and closes it after producing the PDF. It renders US Letter, one-column, selectable text with page breaks and ATS-friendly headings. A working Playwright Chromium installation is required.
