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

