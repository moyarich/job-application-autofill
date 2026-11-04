# MoyaApply

Standalone **React + TypeScript** job application dashboard with a local **Node.js + Playwright** runner. Not a browser extension.

## Run

Requires Node.js 20+, Chromium for Playwright, and Poppler for PDF extraction.

```sh
npm ci
npx playwright install chromium
# macOS, for PDF resume parsing:
brew install poppler
```

Run these in two terminals:

```sh
npm run dev:server
npm run dev --workspace apps/playground
```

Open http://localhost:5173.

## Features

- Add, search, and track job applications (persisted in browser localStorage).
- PDF/DOCX resume import via the local API, with contact + skills extraction. PDF requires `pdftotext` (Poppler); DOCX is extracted with Node's built-in ZIP inflater. Scanned/image-only PDFs are unsupported.
- Preview and correct parsed candidate details; import/export JSON.
- Select a resume and click Apply on a saved job URL to launch a local Playwright browser session.
- The runner fills recognized text fields and attaches the selected resume, stopping for review.
- Explicit confirm-and-submit action; no automatic submissions. Only HTTPS URLs for Greenhouse, Lever, Ashby, Workday, and SmartRecruiters are allowed.
- Session state and screenshot proof retained locally until browser session is closed.

## Security & limitations

The API listens on `127.0.0.1:4177` and checks the dashboard origin and custom header. Resume extraction and browser automation run locally without a cloud service. Uploaded resumes are written to temporary files for applying and removed when the session closes. Profile fields in the UI use localStorage; browser selected file bytes only exist for the current page session.

Parsing is rule based and may miss or misclassify sections, so edit all extracted fields before applying. Playwright supports common text inputs; custom selects, MFA, CAPTCHAs, account logins and unknown questions require manual intervention. It does not bypass anti-bot mechanisms. The browser is headed by default; `HEADLESS=true` is supported for scripted testing.

The screenshot is an approximate visual reference, not proof of real ATS coverage. Always verify the destination, content and application result on the employer website.

## Source structure

- `apps/playground`: React + Vite application
- `packages/job-application-autofill`: typed candidate and job models
- `server/resume.mjs`: resume text extraction and profile heuristics
- `server/automation.mjs`: Playwright review-before-submit sessions
- `server/index.mjs`: local JSON HTTP API

## Checks

```sh
npm run checks
```
