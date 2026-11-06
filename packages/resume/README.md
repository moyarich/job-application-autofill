# extract-resume

Local PDF and DOCX résumé extraction for the command line and Node.js. The
`@moyarich/resume` workspace package powers résumé parsing in
job-application-autofill. The CLI uses Commander.js and the same extraction code
as the app. Document processing runs locally; résumé contents are not sent to a
cloud parsing service.

## Install

This package is currently a private workspace package, not a published npm command.
From the repository root, install the workspace dependencies:

```sh
npm install
npm run build:js --workspace packages/resume
npm exec -- extract-resume --help
```

Use Node.js 22.12 or newer (required by Commander.js 15). DOCX extraction needs no
Python environment. For PDF files, configure Python below or run inside the app's
Docker container.

## Build

From the repository root:

```sh
npm run build --workspace packages/resume
```

This builds the JavaScript library and Commander CLI with Vite, emits TypeScript
declarations, then installs the Python PDF/OCR dependencies. If Poetry is missing,
the build installs it automatically into the project-local
`packages/resume/node_modules/.cache/poetry` virtual environment, then
runs `poetry install --only main --no-root --no-interaction`.
A compatible Python (3.12 through 3.14) must already be installed. The bootstrap
reuses Poetry when available and does not modify global Python packages.
Build output is written to `dist/` as Node.js ES modules.

The Poetry project uses `package-mode = false`, so this step installs dependencies;
it does not create a Python wheel with `poetry build`.

Use `npm run build:js --workspace packages/resume` for only the Vite and
declaration build, `npm run build:python --workspace packages/resume` for
only Poetry setup, and `npm run typecheck --workspace packages/resume`
for TypeScript checks. All extraction modules and the CLI use TypeScript with strict checking.

## CLI

Run these commands from the repository root:

```sh
# Print structured JSON to stdout
npm exec -- extract-resume "Moya Richards - Resume.pdf"

# Save structured JSON to a new file
npm exec -- extract-resume "Moya Richards - Resume.pdf" -o resume.json

# Extract plain text
npm exec -- extract-resume resume.docx --text

# Show available options or the package version
npm exec -- extract-resume --help
npm exec -- extract-resume --version
```

| Argument or option    | Behavior                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `<file>`              | Required path to a PDF or DOCX file. Quote paths containing spaces.                      |
| `-o, --output <file>` | Write to a new file instead of stdout. Refuses to overwrite an existing file.            |
| `--text`              | Return extracted plain text instead of structured JSON. Can be combined with `--output`. |
| `-h, --help`          | Display usage.                                                                           |
| `-V, --version`       | Display the package version.                                                             |

Successful extraction exits with code 0. Errors go to stderr and exit with a
nonzero code. Output files are created with mode `0600` on systems supporting Unix
permissions. The source document is read without being modified.

### PDF setup on the host

Python 3.14.10 is the current host target. Python 3.15 is not enabled because
ONNX Runtime 1.31.1 does not publish Python 3.15 wheels for macOS ARM64.

For pyenv users, this checkout selects Python 3.14.10 with Python 3.10.6 as a command fallback
through its local `.python-version`. Python uses 3.14.10; the fallback makes the
existing Poetry command installed under 3.10.6 available. This keeps
the package separate from a parent directory's Python selection (Python 3.15 is
outside this package's supported range).

The build automatically installs Poetry if needed, then prepares the Python environment:

```sh
npm run build --workspace packages/resume
npm exec -- extract-resume "Moya Richards - Resume.pdf" -o resume.json
```

PDF extraction first checks `PYTHON_EXECUTABLE` if set, then an existing Poetry
virtual environment, then `python3` and `python`. The selected interpreter must
contain `pypdfium2`, `rapidocr`, `onnxruntime`, and Pillow. Runtime discovery
never installs Python packages or invokes Poetry installation. If no interpreter
has the required dependencies, run `npm run build:python --workspace packages/resume`
from the repository root, or run the app in Docker. The build script provisions
Poetry and the PDF/OCR dependencies; it requires a compatible Python interpreter
to already be installed.

To select an interpreter explicitly:

```sh
PYTHON_EXECUTABLE=/absolute/path/to/venv/bin/python npm exec -- extract-resume resume.pdf
```

An invalid explicit override fails rather than silently selecting another Python.

### PDF extraction with Docker

The app image includes the Python dependencies. Starting Docker does not install
those dependencies on the host; run the CLI inside the container to use them:

```sh
# Build and start the app from the repository root
npm run dev
```

In another terminal, from the repository root:

```sh
# Copy a local résumé into the running API container
# Use a distinct temporary filename if you already have a file at this path.
docker compose cp "Moya Richards - Resume.pdf" api:/tmp/extract-resume-input.pdf

# Save JSON on the host; choose an output filename that does not already exist.
docker compose exec -T api node packages/resume/dist/extract-resume.js /tmp/extract-resume-input.pdf > resume.json
```

The Docker example uses shell redirection, which can overwrite an existing host
file. The CLI's overwrite protection applies when using its `--output` option.
Rebuild the Docker image after changing package source code.

## JSON output and app use

The parser returns the [standalone résumé contract](src/resume-schema/resume.schema.json).
See the [example JSON](src/resume-schema/resume.example.json). The root fields are
`contact`, `summary`, `experience`, `skills`, `education`, `projects`,
`certifications`, `languages`, `awards`, and `source`.

Extraction attempts to identify contact details, summary, dated employment,
explicit skills, education, and certifications. Unknown values remain empty;
projects, languages, and awards currently return empty arrays. The CLI records the
input basename in `source.fileName`.

Import CLI JSON through **Candidate profile → Import JSON** or **Resume parser →
Import résumé JSON** in the app. JSON contains résumé data, not the original PDF
or DOCX attachment. Review extracted fields before using them to autofill an
application. Parsing does not submit applications.

## Node.js API

```js
import { readFile } from "node:fs/promises";
import {
  decodeUpload,
  extractResumeText,
  extractProfile,
} from "@moyarich/resume";

const buffer = await readFile("resume.pdf");
const upload = decodeUpload({
  fileName: "resume.pdf",
  base64: buffer.toString("base64"),
});
const text = await extractResumeText(upload.buffer, upload.extension);
const profile = {
  ...extractProfile(text),
  source: { fileName: upload.fileName },
};
```

- `decodeUpload(payload)` validates the upload type, signature, and size and returns
  its buffer, extension, and sanitized filename.
- `extractResumeText(buffer, extension)` returns text asynchronously. PDF uses
  PDFium and falls back to RapidOCR for pages with insufficient selectable text.
  DOCX reads document XML using built-in ZIP decompression.
- `extractProfile(text)` converts text to the structured résumé object using local
  heuristics. Direct API callers set `source.fileName` themselves.
- `extractEmploymentHistory(text)` exposes dated work-history extraction separately.

## Limits and known issues

Uploads are limited to 10 MB. PDF extraction supports up to 30 pages, renders OCR
pages at 250 DPI, and gives the Python extraction worker a 120-second timeout.
Python interpreter discovery verifies dependencies without installing anything.
Environment provisioning runs only during the explicit Python build step.

The parser is heuristic. Known cases needing correction include consecutive
promotions with inline dates, date ranges mistaken for missing phone numbers,
newline-separated skills merged into one value, and multiline certification
metadata emitted as separate credentials. Education dates and contact location
are not currently extracted. Complex columns and unusual headings can also affect
reading order and section detection. Valid JSON structure does not guarantee
that every extracted value is correct.

## Tests

Run the CLI and parser tests from the repository root:

```sh
npm run build:js --workspace packages/resume
npx vitest run tests/extract-resume-cli.test.ts tests/resume.test.ts tests/experience.test.ts tests/pdf-python-runtime.test.ts
```

Run the Python tests with their optional dependencies:

```sh
cd packages/resume
poetry install --with test --no-root
npm run test:python
```

The Python environment is managed through `pyproject.toml`; Poetry package mode is
disabled because the Node.js workspace owns this package.

## Package layout

- `src/extract-resume/`: PDF/DOCX extraction and the `extract-resume` CLI.
- `src/create-resume/`: the `create-resume` JSON-to-PDF CLI.
- `src/resume-schema/`: schema, validation, PDF generation, and examples.
- `python/`: PDFium/OCR worker.

Both CLI commands are built by `npm run build:js --workspace packages/resume`.

```sh
npm exec -- create-resume packages/resume/src/resume-schema/resume.example.json -o resume.pdf
```
