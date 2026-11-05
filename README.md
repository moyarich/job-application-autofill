# MoyaApply

Standalone **React + TypeScript** job application dashboard with a local **Node.js + Playwright** runner. Not a browser extension.

## Persistent local SQLite storage

MoyaApply stores your **structured résumé JSON**, application records, statuses and notes in a SQLite database rather than browser localStorage. The local API owns the database, not the PDF extractor. The app loads saved records on startup and automatically saves edits. Writes are atomic and revision-checked to avoid silently overwriting another tab's updates; if a conflict occurs, reload to pick up the saved state.

- **Docker Compose:** database at `/app/data/moyaapply.sqlite`, persisted in the named `moya_data` volume. Ordinary `docker compose down` does not remove the data. **`docker compose down -v` deletes the database volume**, so back up before using it.
- **Without Docker:** database at `./data/moyaapply.sqlite` relative to the API process working directory. Override with `MOYA_DB_PATH=/absolute/path/moyaapply.sqlite`.
- **Backups:** stop the API and copy the SQLite file (and any WAL file), or use SQLite's online backup command while it is running. The database contains personal résumé information; keep backups private.
- **Scope:** structured résumé and tracked job data persist. Uploaded PDF bytes, live Playwright sessions and screenshots are not stored in SQLite; a PDF can be regenerated from JSON when preparing an application. No browser-localStorage migration is provided because this is a new application.

SQLite uses the built-in Node.js `node:sqlite` module (Node.js 22.13+); no native npm packages or external database server are required.

## Start the complete app with npm

```sh
npm ci
npm run dev
```

Run this from the repository root with **Docker Engine/Desktop and Docker Compose v2 installed and running**. It starts the entire stack: React/Vite, the Node API, SQLite storage, Playwright Chromium, and the interactive noVNC browser viewer. The first start creates a private `.env` with a randomly generated VNC password (printed once and saved in the file), unless `WEB_VNC_PASSWORD` is already configured. Custom passwords are preserved. To change ports, edit `.env`.

Open the dashboard at **http://localhost:5173** and the browser viewer at **http://localhost:6080/vnc.html**. Use the password in `.env` when prompted for the viewer. Stop the stack with Ctrl+C or `npm run dev:down`. View logs with `npm run dev:logs`. SQLite data remains in the Docker volume after a normal stop.

`npm run dev:web` runs **only Vite**; it is useful when the API is already running separately and does not start the full application.

## Run with Docker Compose

For manual Docker Compose usage, configure a private VNC password in an untracked `.env` file, then start the stack:

```sh
cp .env.example .env
# Edit .env and set WEB_VNC_PASSWORD before starting.
docker compose up --build
```

Open http://localhost:5173. The **interactive Playwright browser viewer** is available at http://localhost:6080/vnc.html (or use the embedded **live browser viewer** in the application review panel (with a full-window option)). Enter the password configured as `WEB_VNC_PASSWORD`. Override local ports with `MOYA_WEB_PORT=5174` or `MOYA_REVIEW_PORT=6081`.

Compose uses `docker/Dockerfile` for the React/Vite `web` service and local Node/Playwright/Poetry `api` service. The backend stays on the internal Docker network; only the web port is bound to `127.0.0.1`. Python OCR is installed from `packages/extract-resume/pyproject.toml` at image build time. Rebuild the image after source changes.

**Interactive browser review:** Docker launches Chromium in an Xvfb desktop with noVNC (password protected). The viewer and dashboard are published on host-loopback ports only, not on the public interface. Before final submission you must open the viewer, inspect the actual employer form, complete any mandatory fields, check the review acknowledgment, and explicitly click **Confirm & submit**. VNC password authentication uses a legacy protocol (only the first eight password bytes are significant); do not expose port 6080 externally or use this setup across an untrusted network. The display is shared among application sessions.

## Run without Docker

Requires Node.js 22.13+ (for built-in node:sqlite), Chromium for Playwright, Python 3.10–3.13 and Poetry for the local PDF OCR environment.

```sh
npm ci
npx playwright install chromium
# Install Poetry first (e.g. pipx install poetry)
cd packages/extract-resume
poetry install --with test --no-root
cd ../..
```

For advanced host-only development without the Docker noVNC viewer, run these in two terminals:

```sh
PYTHON_EXECUTABLE="$(cd packages/extract-resume && poetry env info --executable)" npm run dev:server
npm run dev --workspace apps/playground
```

Open http://localhost:5173.

## Use résumé JSON without a parser

**Résumé parsing is optional.** The canonical data format lives in [`resume-schema/resume.schema.json`](resume-schema/resume.schema.json), independent of `packages/extract-resume`. Download [an example JSON résumé](resume-schema/resume.example.json), replace the sample information with your own, and open **Candidate profile → Import JSON** (or **Resume parser → Import résumé JSON**).

Importing does **not** call the OCR/PDF parser or require a résumé file. You can edit the profile, then select **Apply** on a saved job. ATS adapters read `profile.contact`, `profile.experience`, and other structured sections directly; a PDF/DOCX attachment is optional and separate. The backend validates the same JSON contract before launching Playwright. Unsupported form fields remain for interactive browser review.

The JSON contains `contact`, `summary`, `experience`, `skills`, `education`, `projects`, `certifications`, `languages`, `awards`, and `source`. `source.fileName` may be empty. There is no legacy flat-profile format or migration layer.

## Application résumé inputs: JSON + PDF

The JSON résumé drives ATS autofill; a PDF résumé is attached to the employer's application. You can import a schema-valid résumé JSON directly without using OCR or the extractor. When clicking **Apply**, MoyaApply attaches the uploaded PDF if one is available; otherwise it renders the current JSON to a PDF and attaches that generated file automatically. You can export and review the PDF separately before applying.

The PDF generator supports Latin text; if a résumé contains unsupported characters and no uploaded PDF is available, application preparation reports an error rather than attaching corrupted text. A file-input mismatch or custom upload widget still requires manual completion in the browser viewer. Final submission always requires explicit browser review and confirmation.

## Generate an ATS-friendly PDF from résumé JSON

Import a JSON résumé conforming to [`resume-schema/resume.schema.json`](resume-schema/resume.schema.json), or optionally parse a PDF/DOCX into that structure. On the **Candidate profile** page, select **Export PDF**; the same action is available next to the parsed profile preview. The browser generates and downloads a standard US Letter PDF without uploading personal information to an external service.

The standalone generator [`resume-schema/pdf.mjs`](resume-schema/pdf.mjs) creates a single-column, left-aligned document with ordinary headings, plain text bullets, selectable text, reverse-chronological work experience and automatic page breaks. This PDF generation functionality works directly from JSON; it does **not** depend on `packages/extract-resume`, Python, OCR or a source PDF file.

The built-in font supports Latin text; unsupported Unicode characters produce an actionable error rather than a corrupted résumé. As with any résumé, review the finished PDF and follow the employer's file-format instructions.

## Features

- Add, search, and track job applications (persisted in local SQLite).
- PDF/DOCX resume import via the local API, with contact + skills extraction. PDF uses pypdfium2 for embedded text and RapidOCR/ONNX Runtime for scanned-page OCR; DOCX is extracted with Node's built-in ZIP inflater. OCR is only run for pages with insufficient selectable text.
- Preview and correct parsed candidate details; import/export JSON.
- Select a resume and click Apply on a saved job URL to launch a local Playwright browser session.
- The runner fills recognized text fields and attaches the selected resume, stopping for review.
- Explicit confirm-and-submit action; no automatic submissions. Only HTTPS URLs for Greenhouse, Lever, Ashby, Workday, and SmartRecruiters are allowed.
- Session state and screenshot proof retained locally until browser session is closed.

## ATS adapters, login flows and employer-specific questions

The Playwright runner recognizes **Greenhouse, Lever, Ashby, Workday and SmartRecruiters**. Each supported domain has an adapter with common candidate-field mappings, including full-name-only forms. The runner detects sign-in, registration, SSO redirects and security challenges and pauses for manual completion in the noVNC browser. Passwords, verification codes and CAPTCHA solutions are never collected in the dashboard.

Once login has finished, use **I've finished — continue**. On multi-step forms, advance via the live employer browser and click **Refresh form after next step** to inspect newly visible questions. The dashboard can fill *only answers you provide explicitly*. Dropdowns, text areas and checkboxes are supported where their accessible labels and options match; complex autocomplete widgets and unknown controls remain manual. Voluntary demographic questions and sensitive identifiers are not filled automatically.

A browser-fixture suite covers all five ATS adapters without contacting employers:

```sh
node --test tests/ats-browser.test.mjs
```

For **opt-in, read-only live job-page diagnostics**, provide public application URLs for the ATS systems you want to inspect, then run:

```sh
ATS_LIVE_URLS='{"greenhouse":"https://boards.greenhouse.io/YOUR-COMPANY/jobs/JOB-ID"}' node tests/live-ats-smoke.mjs
```

Replace the example URL with a real, publicly accessible job posting. This check only navigates and discovers fields; it does not authenticate, provide candidate data, or submit applications. Login-gated and employer-customized flows require manual end-to-end testing.

## Security & limitations

In Docker the API listens on the internal Compose network and checks the dashboard origin and custom header. Resume extraction and browser automation run locally without a cloud service. Uploaded resumes are written to temporary files for applying and removed when the session closes. Profile fields in the UI use localStorage; browser selected file bytes only exist for the current page session.

Field mapping remains rule based, and OCR may misread low-quality scans or complex layouts. Review and correct extracted fields before applying. Playwright supports common text inputs; custom selects, MFA, CAPTCHAs, account logins and unknown questions require manual intervention. It does not bypass anti-bot mechanisms. The browser is headed by default and uses Xvfb/noVNC in Docker; `HEADLESS=true` is supported for scripted testing outside the interactive-review Compose setup.

The screenshot is an approximate visual reference, not proof of real ATS coverage. Always verify the destination, content and application result on the employer website.

## Source structure

- `apps/playground`: React + Vite application
- `packages/job-application-autofill`: typed candidate and job models
- `packages/extract-resume`: independent reusable PDF/DOCX parsing package, with Python OCR worker and tests
- `packages/extract-resume/src/index.mjs`: Node.js resume extraction and profile heuristics
- `packages/extract-resume/python/pdf_ocr.py`: PDFium extraction and RapidOCR fallback
- `packages/extract-resume/pyproject.toml`: Poetry dependency groups and OCR environment
- `playwright-adapters/`: separate Greenhouse, Lever, Workday, Ashby and SmartRecruiters modules
- `server/automation.mjs`: Playwright review-before-submit sessions
- `server/index.mjs`: local JSON HTTP API

## Checks

```sh
npm run checks
```

## PDF OCR tests

```sh
cd packages/extract-resume
poetry install --with test --no-root
poetry run python -m unittest discover -s python -p 'test_*.py' -v
```

To force a particular Python interpreter for the Node backend, set `PYTHON_EXECUTABLE`. By default, the backend invokes `python3`. PDF extraction is local and does not contact an external parsing API. RapidOCR may initialize its inference models on first OCR use.
