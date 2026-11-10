# @moyarich/resume

Structured resume types, schema validation, Markdown conversion, and HTML/PDF generation.
Node.js extraction and the `extract-resume` CLI live here. The Python worker and
Poetry project live in [`resume-ocr`](../resume-ocr/README.md).

## Build

From the repository root:

```sh
npm run build:js --workspace packages/resume
```

Vite writes JavaScript to `dist/`; TypeScript generates declarations there.
PDF extraction invokes the installed `resume_ocr` module as a subprocess.
Set `PYTHON_EXECUTABLE` to its interpreter. Provision a local wheel installation
from the repository root with `npm run build:python`. DOCX parsing and document rendering do not use Python.

## Public entry points

- `@moyarich/resume`: `Resume` and `EmploymentEntry` types plus extraction and profile parsing.
- `@moyarich/resume/validate`: schema validation and JSON parsing.
- `@moyarich/resume/markdown`: Markdown rendering, plain text, editor conversions, and resume Markdown export.
- `@moyarich/resume/render-html`: resume HTML rendering.
- `@moyarich/resume/create-pdf`: PDF generation with Playwright Chromium.

## CLI

```sh
npm exec -- create-resume packages/resume/src/resume-schema/resume.example.json -o resume.pdf
```

Install Chromium with `npx playwright install chromium` before generating PDFs.
See [the schema documentation](src/resume-schema/README.md) for the resume contract.

```sh
npm exec -- extract-resume /path/to/resume.pdf
```
