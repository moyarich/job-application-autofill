# MoyaApply

Standalone **React + TypeScript** job application dashboard with a local **Node.js + Playwright** runner. Not a browser extension.

## Run with Docker Compose

From the repository root, configure a private VNC password in an untracked `.env` file, then start the stack:

```sh
cp .env.example .env
# Edit .env and set WEB_VNC_PASSWORD before starting.
docker compose up --build
```

Open http://localhost:5173. The **interactive Playwright browser viewer** is available at http://localhost:6080/vnc.html (or use the embedded **live browser viewer** in the application review panel (with a full-window option)). Enter the password configured as `WEB_VNC_PASSWORD`. Override local ports with `MOYA_WEB_PORT=5174` or `MOYA_REVIEW_PORT=6081`.

Compose uses `docker/Dockerfile` for the React/Vite `web` service and local Node/Playwright/Poetry `api` service. The backend stays on the internal Docker network; only the web port is bound to `127.0.0.1`. Python OCR is installed from `packages/extract-resume/pyproject.toml` at image build time. Rebuild the image after source changes.

**Interactive browser review:** Docker launches Chromium in an Xvfb desktop with noVNC (password protected). The viewer and dashboard are published on host-loopback ports only, not on the public interface. Before final submission you must open the viewer, inspect the actual employer form, complete any mandatory fields, check the review acknowledgment, and explicitly click **Confirm & submit**. VNC password authentication uses a legacy protocol (only the first eight password bytes are significant); do not expose port 6080 externally or use this setup across an untrusted network. The display is shared among application sessions.

## Run without Docker

Requires Node.js 20+, Chromium for Playwright, Python 3.10–3.13 and Poetry for the local PDF OCR environment.

```sh
npm ci
npx playwright install chromium
# Install Poetry first (e.g. pipx install poetry)
cd packages/extract-resume
poetry install --with test --no-root
cd ../..
```

Run these in two terminals:

```sh
PYTHON_EXECUTABLE="$(cd packages/extract-resume && poetry env info --executable)" npm run dev:server
npm run dev --workspace apps/playground
```

Open http://localhost:5173.

## Features

- Add, search, and track job applications (persisted in browser localStorage).
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
