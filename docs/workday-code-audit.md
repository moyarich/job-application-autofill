# Workday code-location audit

Audited on the `fix/workday-env-credentials` branch, November 6, 2026.

## Ownership boundary

- `packages/job-sites/workday/` owns provider-specific Playwright selectors, work-history and education controls, skills, sign-in/sign-up, employer-tenant identity and retry behavior for Workday uploads.
- `packages/job-sites/index.ts` owns the adapter registry and shared question discovery, classification and filling.
- `packages/job-sites/automation.ts` owns shared browser/session lifecycle, URL validation, resume attachment lifecycle, ATS dispatch, and final review/submission safeguards.
- `packages/job-sites/employer-account.ts` owns the shared employer-identity API, delegating Workday tenant extraction to the Workday module.
- `tests/workday/` owns Workday behavior regression tests. `tests/ats/` contains the cross-provider adapter and account-isolation fixtures, some of which intentionally mention Workday.

## Provider-owned implementations

| Module | Responsibility |
| --- | --- |
| `workday/index.ts` | Workday adapter registration data, hostnames, and common field mappings |
| `workday/identity.ts` | Employer tenant key extraction |
| `workday/autofill.ts` | Coordination of Workday experience, education, skills, location exception and repeat upload |
| `workday/experience.ts` | Work-history cards and date inputs |
| `workday/education.ts` | Education controls |
| `workday/skills.ts` | Skill selection and deduplication |
| `workday/workday-login.ts` | Configured-host credentials, Workday sign-in and login diagnostics |
| `workday/workday-sign-up.ts` | Prepopulate Workday registration email without submitting |

## Remaining external references (expected)

- `packages/job-sites/automation.ts`: Workday adapter dispatch and diagnostic routing, not provider DOM implementation.
- `packages/job-sites/employer-account.ts`: dispatch to `workdayEmployerTenant()`.
- `packages/job-sites/index.ts`: provider registry import.
- `.env.example`, `docker-compose.yml`: Workday environment variable names and legacy aliases.
- `README.md`, `packages/job-sites/README.md`: user-facing provider support and credentials documentation.
- Workday Vitest tests run through the regular test workflow; Docker CI keeps its container smoke checks and ATS integration fixtures.
- `tests/ats/`: cross-ATS host discovery, form fixture and employer identity tests.
- `tests/workday/`: provider-specific regression tests.

## Changes made

1. Extracted Workday form logic to `workday/autofill.ts`.
2. Extracted Workday employer-tenant identification to `workday/identity.ts`.
3. Replaced the duplicate hostname regex in the shared URL validator with `adapterForUrl()`, preserving HTTPS and credential checks.
4. Scoped Workday-specific login error messages to the Workday adapter and moved the diagnostic text to `workday/workday-login.ts`.
5. Corrected the package README's stale Workday test command.

## Validation

Suggested checks:

```bash
npm run typecheck --if-present
npx vitest run tests/workday tests/ats tests/automation
npm run lint --if-present
```

These are suggested commands, not an assertion that the latest commit passed CI. The earlier successful CI runs predate this refactor.
