# @moyarich/job-application-autofill

Typed, framework-agnostic candidate profile and application models for MoyaApply.

## Exports

- `CandidateProfile`, `emptyCandidate`, `validateCandidate`, `parseCandidateJson`
- `JobApplication`, `ApplicationStatus`, `statuses`, `createApplication`

The React + TypeScript application is in `apps/playground`.

## Current scope

This is a local-first candidate profile and job tracker. No Playwright runner, ATS automation, resume parsing, or application submission is implemented yet. The resume picker retains the selected File object only for the active page session; JSON exports contain a filename only.
