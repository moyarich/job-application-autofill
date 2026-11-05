# MoyaApply

Standalone **React + TypeScript** job application dashboard with a local **Node.js + Playwright** runner. Not a browser extension.

## Run

Requires Node.js 20+, Chromium for Playwright, Python 3.10+ and the Python OCR requirements for PDF extraction.

```sh
npm ci
npx playwright install chromium
# macOS/Linux:
python3 -m venv .venv
.venv/bin/python -m pip install -r packages/extract-resume/python/requirements-ocr.txt
# Windows: use .venv\\Scripts\\python.exe instead
```

Run these in two terminals:

```sh
PYTHON_EXECUTABLE=.venv/bin/python npm run dev:server
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

## Security & limitations

The API listens on `127.0.0.1:4177` and checks the dashboard origin and custom header. Resume extraction and browser automation run locally without a cloud service. Uploaded resumes are written to temporary files for applying and removed when the session closes. Profile fields in the UI use localStorage; browser selected file bytes only exist for the current page session.

Field mapping remains rule based, and OCR may misread low-quality scans or complex layouts. Review and correct extracted fields before applying. Playwright supports common text inputs; custom selects, MFA, CAPTCHAs, account logins and unknown questions require manual intervention. It does not bypass anti-bot mechanisms. The browser is headed by default; `HEADLESS=true` is supported for scripted testing.

The screenshot is an approximate visual reference, not proof of real ATS coverage. Always verify the destination, content and application result on the employer website.

## Source structure

- `apps/playground`: React + Vite application
- `packages/job-application-autofill`: typed candidate and job models
- `packages/extract-resume`: independent reusable PDF/DOCX parsing package, with Python OCR worker and tests
- `server/resume.mjs`: Node bridge to the local Python extractor and profile heuristics\n- `server/pdf_ocr.py`: PDFium extraction with lazy RapidOCR fallback for scanned pages\n- `packages/extract-resume/python/requirements-ocr.txt`: Python OCR dependencies
- `server/automation.mjs`: Playwright review-before-submit sessions
- `server/index.mjs`: local JSON HTTP API

## Checks

```sh
npm run checks
```

## PDF OCR tests

```sh
# Installs the optional fixture library for Python tests.
.venv/bin/python -m pip install reportlab
.venv/bin/python -m unittest discover -s packages/extract-resume/python -p 'test_*.py' -v
```

To force a particular Python interpreter for the Node backend, set `PYTHON_EXECUTABLE`. By default, the backend invokes `python3`. PDF extraction is local and does not contact an external parsing API. RapidOCR may initialize its inference models on first OCR use.
