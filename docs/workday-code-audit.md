# Workday code-location audit

Audited on the `fix/workday-env-credentials` branch, November 6, 2026.

## Ownership boundary

- `packages/job-sites/workday/` owns provider-specific Playwright selectors, work-history and education controls, skills, sign-in/sign-up, employer-tenant identity and retry behavior for Workday uploads.
- `packages/job-sites/types.ts` defines the typed `JobSiteAdapter` contract. `packages/job-sites/index.ts` owns the registry and shared question discovery, classification and filling.
- `packages/job-sites/automation.ts` owns shared browser/session lifecycle, URL validation, resume attachment lifecycle, adapter-hook dispatch, and final review/submission safeguards.
- `packages/job-sites/employer-account.ts` owns the shared employer-identity API and delegates tenant detection to each adapter.
- `tests/workday/` owns Workday behavior regression tests. `tests/ats/` contains the cross-provider adapter and account-isolation fixtures, some of which intentionally mention Workday.

## Provider-owned implementations

| Module                       | Responsibility                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `workday/index.ts`           | Workday adapter registration data, hostnames, and common field mappings                     |
| `workday/identity.ts`        | Employer tenant key extraction                                                              |
| `workday/steps.ts`           | Coordination of Workday experience, education, skills, location exception and repeat upload |
| `workday/experience.ts`      | Work-history cards and date inputs                                                          |
| `workday/education.ts`       | Education controls                                                                          |
| `workday/skills.ts`          | Skill selection and deduplication                                                           |
| `workday/workday-login.ts`   | Configured-host credentials, Workday sign-in and login diagnostics                          |
| `workday/workday-sign-up.ts` | Prepopulate Workday registration email without submitting                                   |

## Typed provider contract

`packages/job-sites/types.ts` defines `JobSiteAdapter`. Every provider uses `satisfies JobSiteAdapter` and implements `employerTenant()`. Optional hooks cover field skipping, profile filling, repeat resume uploads, entering the application flow, account sign-in, and provider-specific login messages. The registry preserves provider methods and shared automation calls them without Workday ID checks. `tests/ats/adapter-contract.test.ts` covers adapter identity and hooks.

## Site-defined step dispatch (latest)

There is deliberately **no fixed section enum** in the job-site adapter contract. Each provider owns a `steps` array with arbitrary step IDs and `matches(context)` / `run(context)` functions. The shared orchestrator does not identify contact, employment, education, or other sections. It evaluates only the current adapter's declared steps and checks the destination host before and after each action. If an employer page has no matching step, no form action is attempted. Workday's steps live in `packages/job-sites/workday/steps.ts`; Workday's contact selector implementation lives in `workday/contact.ts`. Other providers have no automatic section steps until their own implementations are added and verified. Shared form utilities remain available to explicitly opt into, but never run as an automatic fallback.
