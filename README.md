# MoyaApply

A standalone **React + TypeScript** job application workspace (not a browser extension).

## Features

- Candidate profile editor with required name/email validation
- Local profile JSON import/export
- PDF/DOCX file selection (not yet parsed or uploaded)
- Job application tracker with status changes, job URLs and search
- Local persistence using browser `localStorage`
- Responsive layout

## Run locally

```bash
npm install
npm run dev --workspace apps/playground
```

Run validations:

```bash
npm run checks
```

## Architecture

- `apps/playground`: React 19 + Vite + TypeScript interface
- `packages/job-application-autofill`: shared TypeScript candidate and application models
- `tests`: Vitest tests
- Existing GitHub Actions workflows continue to provide CI and releases.

## Planned automation (not implemented)

Use an external Node.js/Playwright service for Greenhouse, Lever, Workday and other ATS flows, with review-before-submit. A local API or desktop shell will be needed to securely store resume files and automate browser applications. This prototype does not parse a resume, launch Playwright, or submit an application.

Profile data is currently saved in the browser's localStorage. Do not put passwords, authentication tokens or other secrets in profile fields.
