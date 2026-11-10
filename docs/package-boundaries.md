# Package boundaries

Workspace packages consume each other by package name and declared public exports.
Do not use relative paths into a sibling package, including for types. ESLint's
`boundaries/public-imports` rule checks static imports, re-exports, dynamic imports,
and TypeScript import types in `packages/` and `apps/`.

- `@moyarich/resume` owns the `Resume` and `EmploymentEntry` types, validation, and document rendering. Its
  `/validate`, `/create-pdf`, `/render-html`, and `/markdown`
  entry points expose the corresponding resume operations. Build it with
  `npm run build:js --workspace packages/resume` before consuming its output.
- `@moyarich/job-boards` owns adapters and question discovery. `/automation`,
  `/employer-account`, and `/screening-policy` expose the shared application,
  employer identity and screening-answer APIs. Vite produces JavaScript in
  `dist/`, and TypeScript generates declarations there. The screening-policy entry point
  is browser-safe and does not load Playwright.

Declare each consumed package in the consumer's dependencies. Add explicit exports
when a new shared API is needed; do not expose arbitrary internal paths with a wildcard.
Repository tests may import internal files to exercise implementation details.

`@moyarich/resume-api` also builds into `dist/` with Vite, preserving its module
layout and copying SQL tables alongside the compiled database code. Start it with
`npm run start --workspace packages/resume-api`.

Run `npm run build:js` at the repository root to build all JavaScript packages in
dependency order. `npm run build` additionally builds the Python runtime and playground.

## Ownership

Code that a package only exports, without using internally, belongs in its sole
consumer when no other package shares it. Tests do not count as a separate package
consumer. Public exports alone do not justify keeping code in a shared package.

`@moyarich/resume/markdown` owns Markdown rendering, editor conversion helpers,
and structured resume Markdown export. The UI consumes that public entry point.
Job boards own plain-text profile preparation for autofill. The API owns PDF
attachment request decoding. Resume owns the shared resume types,
validation, rendering, and Markdown primitives.

`packages/resume-ocr` is an installable Python package for PDF text extraction
and OCR. It is not an npm workspace and does not serve HTTP. Its public interfaces
are `from resume_ocr import extract_pdf`, `python -m resume_ocr`, and `resume-ocr`.
Node.js invokes the installed module through `PYTHON_EXECUTABLE` or an available
Python interpreter. It does not inspect a source directory or Poetry environment.
`resume-api/requirements.txt` pins the installed package version. Docker builds a
wheel, installs it without an editable link, and omits its source project from
the API runtime image. Node.js extraction, profile parsing, and the `extract-resume`
CLI remain in `@moyarich/resume`.
