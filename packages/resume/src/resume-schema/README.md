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
import { renderResumePdf } from "./packages/resume/src/resume-schema/create-pdf.ts";
import { readFileSync, writeFileSync } from "node:fs";
const resume = JSON.parse(
  readFileSync("./packages/resume/src/resume-schema/resume.example.json", "utf8"),
);
writeFileSync("resume.pdf", await renderResumePdf(resume));
```

The renderer is asynchronous because it launches a fresh headless Chromium instance and closes it after producing the PDF. It renders US Letter, one-column, selectable text with page breaks and ATS-friendly headings. A working Playwright Chromium installation is required.

## Create a PDF from the command line

With Node.js 24 or newer, run from the repository root:

```sh
npm install
npm exec -- create-resume packages/resume/src/resume-schema/resume.example.json -o resume.pdf
npm exec -- create-resume --help
```

The command uses `create-pdf.ts` to generate a PDF from validated structured JSON.
Without `--output`, it uses the input file's directory and basename with a `.pdf`
extension. Existing files are never overwritten. Chromium must be installed for
Playwright (`npx playwright install chromium`). Errors exit with a nonzero status.

## Markdown content and downloads

Summary, experience descriptions, education/project descriptions, and additional-section content use a single Markdown string per field. Slate is the editing interface; no separate editor document is persisted. `markdownToPlainText` and `resumeToPlainText` strip formatting for application autofill, while HTML/PDF rendering preserves formatting with raw HTML disabled.

The Resumes listing provides View, Edit, Copy, Rename, Export, and Delete. Export supports Text, YAML, JSON, PDF, Word (`.docx`), and Markdown. JSON/YAML retain the structured resume contract and Markdown fields; document formats are generated from those same fields.
