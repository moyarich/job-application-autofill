# job-application-autofill

Standalone **React + TypeScript** job application dashboard with a local **Node.js + Playwright** runner. Not a browser extension.

## Persistent local SQLite storage

job-application-autofill stores your **structured résumé JSON**, application records, statuses and notes in a SQLite database rather than browser localStorage. The local API owns the database, not the PDF extractor. The app loads saved records on startup and automatically saves edits. Writes are atomic and revision-checked to avoid silently overwriting another tab's updates; if a conflict occurs, reload to pick up the saved state.

- **Docker Compose:** SQLite is stored on your computer in `./sqlite-data/job_application_autofill.sqlite` (mounted as `/app/data/job_application_autofill.sqlite` in the container), not in a Docker named volume. The `npm run dev` launcher creates `./sqlite-data/` if it does not exist. Data survives Ctrl+C, `docker compose down`, container rebuilds and Docker Desktop shutdown. Even `docker compose down -v` does **not** delete this bind-mounted directory, although that command can remove other named volumes. Keep `./sqlite-data/` private and back it up.
- **Existing installations (migration required):** Before switching from the old named volume `moyaapply_moya_data`, stop Docker Compose and copy its contents to `./sqlite-data/` (see below). Otherwise the new folder starts with an empty SQLite database while the old data remains in its volume. Do not remove the old volume until you have verified the copy.
- **Legacy database filename:** If your installation still uses `moyaapply.sqlite`, keep `MOYA_DB_PATH` pointed at that file until you have backed it up and migrated it. The renamed default is `job_application_autofill.sqlite`; changing the path alone does not move existing data.
- **Git privacy:** `./sqlite-data/` and common SQLite database/WAL/journal filenames are ignored by Git and excluded from Docker builds. Never `git add -f` this directory.
- **Stopping safely:** `npm run dev:down` and Ctrl+C preserve `./sqlite-data/`. Do not delete it unless you want to lose local applications and résumé data.
- **Without Docker:** database at `./data/job_application_autofill.sqlite` relative to the API process working directory. Override with `MOYA_DB_PATH=/absolute/path/job_application_autofill.sqlite`.
- **Backups:** stop the API and copy the SQLite file (and any WAL file), or use SQLite's online backup command while it is running. The database contains personal résumé information; keep backups private.
- **Scope:** structured résumé and tracked job data persist. Uploaded PDF bytes, live Playwright sessions and screenshots are not stored in SQLite; a PDF can be regenerated from JSON when preparing an application. No browser-localStorage migration is provided because this is a new application.

SQLite uses the built-in Node.js `node:sqlite` module (Node.js 22.13+); no native npm packages or external database server are required.

### Migrate from the previous Docker named volume

If you already have saved applications from before this change, stop the application **before** copying the SQLite database and its WAL files:

```sh
docker compose down
mkdir -p sqlite-data
# Check that the old named volume exists before attempting migration.
docker volume inspect moyaapply_moya_data
# Copy all database files (including SQLite WAL/SHM files) to the host folder.
docker run --rm \
  -v moyaapply_moya_data:/from:ro \
  -v "$PWD/sqlite-data:/to" \
  alpine:3.20 sh -c 'cp -a /from/. /to/'
```

Run `npm run dev` and verify your saved résumé and application history. Keep the old volume until you confirm the migration; `docker compose down` does not delete it. This step is needed only when migrating from the previous named-volume configuration.

## Employer account automation

The dashboard tracks candidate account setup **per local person, ATS provider, and employer tenant**. Workday employers have separate accounts even when they share the Workday platform. Greenhouse, Lever, Ashby, and SmartRecruiters use the same employer-scoped flow **when a particular site requires signup**. An application at the same employer can reuse the existing account.

When a new account is required, the application runner attempts to open the employer's registration form and autofill first name, last name and email. In the review panel, **Autofill account signup** can also fill an optional password and password confirmation. Use **Generate** and **Copy** to save a unique password in your password manager before filling it. The optional password is transmitted to the local API only for that request and is **not saved** in SQLite, browser localStorage, session metadata, or logs.

For safety, the automation checks the exact employer host before entering signup fields. It never checks legal agreement boxes, bypasses CAPTCHA or verification, or submits the Create Account form automatically. Complete those steps in the interactive employer browser, then mark the account as created to reuse it. Some employers use SSO or registration on another domain; those steps remain manual. The app's local profiles **do not require sign-in**.

## Start the complete app with npm

```sh
npm ci
npm run dev
```

Run this from the repository root with **Docker Engine/Desktop and Docker Compose v2 installed and running**. It starts the entire stack: React/Vite, the Node API, SQLite storage, Playwright Chromium, and the interactive noVNC browser viewer. The first start creates a private `.env` with a randomly generated VNC password (printed once and saved in the file), unless `WEB_VNC_PASSWORD` is already configured. Custom passwords are preserved. To change ports, edit `.env`.

Open the dashboard at **http://localhost:5173** and the browser viewer at **http://localhost:6080/vnc.html**. Use the password in `.env` when prompted for the viewer. Stop the stack with Ctrl+C or `npm run dev:down`. View logs with `npm run dev:logs`. SQLite data remains in the local `./sqlite-data/` directory after a normal stop.

`npm run dev:web` runs **only Vite**; it is useful when the API is already running separately and does not start the full application.

## Run with Docker Compose

For manual Docker Compose usage, configure a private VNC password in an untracked `.env` file, then start the stack:

```sh
cp .env.example .env
# Edit .env and set WEB_VNC_PASSWORD before starting.
docker compose up --build
```

Open http://localhost:5173. The **interactive Playwright browser viewer** is available at http://localhost:6080/vnc.html (or use the embedded **live browser viewer** in the application review panel (with a full-window option)). Enter the password configured as `WEB_VNC_PASSWORD`. Override local ports with `MOYA_WEB_PORT=5174` or `MOYA_REVIEW_PORT=6081`.

Compose uses `docker/Dockerfile` for the React/Vite `web` service and local Node/Playwright/Poetry `api` service. The backend stays on the internal Docker network; only the web port is bound to `127.0.0.1`. Python OCR is installed from `packages/resume/pyproject.toml` at image build time. Rebuild the image after source changes.

**Interactive browser review:** Docker launches Chromium in an Xvfb desktop with noVNC (password protected). The viewer and dashboard are published on host-loopback ports only, not on the public interface. Before final submission you must open the viewer, inspect the actual employer form, complete any mandatory fields, check the review acknowledgment, and explicitly click **Confirm & submit**. VNC password authentication uses a legacy protocol (only the first eight password bytes are significant); do not expose port 6080 externally or use this setup across an untrusted network. The display is shared among application sessions.

## Run without Docker

Requires Node.js 22.13+ (for built-in node:sqlite), Chromium for Playwright, Python 3.12–3.14 and Poetry for the local PDF OCR environment.

```sh
npm ci
npx playwright install chromium
# Install Poetry first (e.g. pipx install poetry)
cd packages/resume
poetry install --with test --no-root
cd ../..
```

For advanced host-only development without the Docker noVNC viewer, run these in two terminals:

```sh
PYTHON_EXECUTABLE="$(cd packages/resume && poetry env info --executable)" npm run dev:server
npm run dev --workspace apps/playground
```

Open http://localhost:5173.

## Use résumé JSON without a parser

**Résumé parsing is optional.** The canonical data format lives in [`packages/resume/src/resume-schema/resume.schema.json`](packages/resume/src/resume-schema/resume.schema.json), usable without the extraction pipeline. Download [an example JSON résumé](packages/resume/src/resume-schema/resume.example.json), replace the sample information with your own, and open **Candidate profile → Import JSON** (or **Resume parser → Import résumé JSON**).

Importing does **not** call the OCR/PDF parser or require a résumé file. You can edit the profile, then select **Apply** on a saved job. ATS adapters read `profile.contact`, `profile.experience`, and other structured sections directly; a PDF/DOCX attachment is optional and separate. The backend validates the same JSON contract before launching Playwright. Unsupported form fields remain for interactive browser review.

The JSON contains `contact`, `summary`, `experience`, `skills`, `education`, `projects`, `certifications`, `languages`, `awards`, and `source`. `source.fileName` may be empty. There is no legacy flat-profile format or migration layer.

## Application résumé inputs: JSON + PDF

The JSON résumé drives ATS autofill; a PDF résumé is attached to the employer's application. You can import a schema-valid résumé JSON directly without using OCR or the extractor. When clicking **Apply**, job-application-autofill attaches the uploaded PDF if one is available; otherwise it renders the current JSON to a PDF and attaches that generated file automatically. You can export and review the PDF separately before applying.

The PDF generator supports Latin text; if a résumé contains unsupported characters and no uploaded PDF is available, application preparation reports an error rather than attaching corrupted text. A file-input mismatch or custom upload widget still requires manual completion in the browser viewer. Final submission always requires explicit browser review and confirmation.

## Generate an ATS-friendly PDF from résumé JSON

Import a JSON résumé conforming to [`packages/resume/src/resume-schema/resume.schema.json`](packages/resume/src/resume-schema/resume.schema.json), or optionally parse a PDF/DOCX into that structure. On the **Candidate profile** page, select **Export PDF**; the same action is available next to the parsed profile preview. The browser generates and downloads a standard US Letter PDF without uploading personal information to an external service.

The standalone generator [`packages/resume/src/resume-schema/create-pdf.ts`](packages/resume/src/resume-schema/create-pdf.ts) creates a single-column, left-aligned document with ordinary headings, plain text bullets, selectable text, reverse-chronological work experience and automatic page breaks. This PDF generation functionality works directly from JSON; it does **not** depend on the extractor, Python, OCR or a source PDF file.

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

Once login has finished, use **I've finished — continue**. On multi-step forms, advance via the live employer browser and click **Refresh form after next step** to inspect newly visible questions. The dashboard can fill _only answers you provide explicitly_. Dropdowns, text areas and checkboxes are supported where their accessible labels and options match; complex autocomplete widgets and unknown controls remain manual. Voluntary demographic questions and sensitive identifiers are not filled automatically.

A browser-fixture suite covers all five ATS adapters without contacting employers:

```sh
npx --no-install vitest run tests/ats
```

For **opt-in, read-only live job-page diagnostics**, provide public application URLs for the ATS systems you want to inspect, then run:

```sh
ATS_LIVE_URLS='{"greenhouse":"https://boards.greenhouse.io/YOUR-COMPANY/jobs/JOB-ID"}' node tests/ats/live-ats-smoke.ts
```

Replace the example URL with a real, publicly accessible job posting. This check only navigates and discovers fields; it does not authenticate, provide candidate data, or submit applications. Login-gated and employer-customized flows require manual end-to-end testing.

## Security & limitations

In Docker the API listens on the internal Compose network and checks the dashboard origin and custom header. Resume extraction and browser automation run locally without a cloud service. Uploaded resumes are written to temporary files for applying and removed when the session closes. Profile fields in the UI use localStorage; browser selected file bytes only exist for the current page session.

Field mapping remains rule based, and OCR may misread low-quality scans or complex layouts. Review and correct extracted fields before applying. Playwright supports common text inputs; custom selects, MFA, CAPTCHAs, account logins and unknown questions require manual intervention. It does not bypass anti-bot mechanisms. The browser is headed by default and uses Xvfb/noVNC in Docker; `HEADLESS=true` is supported for scripted testing outside the interactive-review Compose setup.

The screenshot is an approximate visual reference, not proof of real ATS coverage. Always verify the destination, content and application result on the employer website.

## Source structure

- `apps/playground`: React + Vite application
- `packages/job-application-autofill`: typed candidate and job models
- `packages/resume`: independent reusable PDF/DOCX parsing package, with Python OCR worker and tests
- `packages/resume/src/extract-resume/index.ts`: Node.js resume extraction and profile heuristics
- `packages/resume/python/pdf_ocr.py`: PDFium extraction and RapidOCR fallback
- `packages/resume/pyproject.toml`: Poetry dependency groups and OCR environment
- `packages/job-sites/`: separate Greenhouse, Lever, Workday, Ashby and SmartRecruiters modules
- `packages/job-sites/automation.ts`: Playwright review-before-submit sessions
- `packages/resume-api/index.ts`: local JSON HTTP API

## Checks

```sh
npm run checks
```

## PDF OCR tests

```sh
cd packages/resume
poetry install --with test --no-root
poetry run python -m unittest discover -s python -p 'test_*.py' -v
```

To force a particular Python interpreter for the Node backend, set `PYTHON_EXECUTABLE`. By default, the backend invokes `python3`. PDF extraction is local and does not contact an external parsing API. RapidOCR may initialize its inference models on first OCR use.

### Optional Workday sign-in from .env

Set `WORKDAY_HOST`, `WORKDAY_USERNAME`, and `WORKDAY_PASSWORD` in the ignored
root `.env` file for an existing employer account. `WORKDAY_USER_EMAIL` is accepted as a username alias; legacy `RESUME_SITE_HOST`, `RESUME_SITE_EMAIL`, and `RESUME_SITE_PASSWORD` remain supported. Copy the names from `.env.example`.
The default tenant is `workday.wd5.myworkdayjobs.com`; credentials are never filled
on another tenant or an external identity provider. Restart/recreate the API after
editing credentials (`docker compose up -d --force-recreate api`).

When preparing an application, the server can open Workday's Apply / Autofill with
Resume flow, select email sign-in, and attempt existing-account sign-in once per
session. Credentials stay server-side and are not saved in candidate JSON or sent
to the dashboard. The browser viewer still uses `WEB_VNC_PASSWORD`.
On a sign-up form, the helper can prefill the configured email only. New passwords,
terms acceptance, SSO, CAPTCHA, and verification codes require manual
action in the viewer. No account is created automatically.

## Workspace structure

- `packages/resume-api`: HTTP API and SQLite persistence for every supported job site.
- `packages/job-sites`: adapter registry, shared browser automation, and site modules.
- `packages/job-sites/workday`: Workday fields, experience, sign-in and sign-up helpers.
- `packages/resume`: schema, PDF export, extraction, Python worker, and both CLI commands.
- `packages/job-application-autofill`: candidate profile and application state utilities.
- `apps/playground`: separate documentation app.

The server selects an adapter from the job URL. Shared orchestration is in
`packages/job-sites/automation.ts`; only Workday-specific actions live under
`packages/job-sites/workday/`. Greenhouse, Lever, Ashby and SmartRecruiters remain
separate adapters. Environment-based authentication currently targets Workday.

### Application pages and viewer connection

Apply opens a dedicated page identified by the saved application UUID. New IDs use
UUID v5 of the trimmed Company, Role and Job URL tuple; adding the same tuple is
blocked as a duplicate. Existing saved IDs remain unchanged. Each page retrieves
only the browser session for its application, and different jobs can have open
sessions at the same time. Application status updates are saved individually.

The embedded viewer authenticates using `WEB_VNC_PASSWORD` from `.env`; it does
not put credentials in URLs or browser storage. Its authenticated local API route
and same-origin VNC proxy are used by the dashboard. Browser windows have separate
application contexts but share the local virtual desktop; focusing an application
viewer brings that job's browser window forward.

Set `NODE_ENV=development` in the root `.env` for local development. Compose passes
it to the API and web services, defaulting to `development` when absent. Changing
it requires recreating the containers. Setting `NODE_ENV=production` alone does
not replace the current Vite development server with a production deployment.

### Standalone application

The real application is `packages/job-application-autofill`. Its entry point mounts
`src/components/App/App.tsx`; feature UI lives under `src/components/*/`, and
API, file, profile and state helpers live under `src/utils/*/`.

```sh
npm run dev --workspace packages/job-application-autofill
npm run build:app
```

The app serves on port 5173. `apps/playground` is a separate documentation entry
on port 5174. Docker and the browser tests target the real application.
