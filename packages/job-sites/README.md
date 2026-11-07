# Playwright ATS adapters

Each provider owns its own adapter module:

- `greenhouse/index.ts`
- `lever/index.ts`
- `workday/index.ts`
- `ashby/index.ts`
- `smart-recruiters/index.ts`

The shared `index.ts` selects adapters by job URL and provides question utilities. Each job site is responsible for its own form detection and autofill steps. Login, SSO, MFA, and CAPTCHA require manual browser interaction.

Run the five-provider fixture checks with `node --test tests/ats-browser.test.ts`.

These are adapter foundations; individual employers can customize their workflows and still require browser review.

## Real-world Workday URL example

[Elevance Health — Developer Senior (JR209310)](https://elevancehealth.wd1.myworkdayjobs.com/en-US/ANT/job/IL-CHICAGO-8600-W-BRYN-MAWR-AVE-10th--11th-FL/Developer-Senior_JR209310) uses the `workday/` adapter because the hostname is `elevancehealth.wd1.myworkdayjobs.com`, **not** Greenhouse.

This URL is included in the adapter classification regression test. Live sign-in, step transitions and employer submission have **not** been verified; only a public listing could be confirmed independently. A listing may require clicking **Apply** and completing an account login before form controls are available.

## Smartsheet — real Greenhouse example

[Sr. Software Engineer I (Remote Eligible), job 8250247](https://job-boards.greenhouse.io/smartsheet/jobs/8250247) is hosted on `job-boards.greenhouse.io`, so it uses `job-sites/greenhouse/`.

Publicly visible application fields include first and last name, **preferred first name**, email, country/phone, city, résumé upload, education, applicant privacy notice, referral relationship, source, LinkedIn, AI familiarity, U.S. work authorization and future sponsorship. These fields vary by employer and change over time.

**Manual review is required** for unprovided preferred name, country/autocomplete, education dropdowns, consent, referral/screening questions, authorization/sponsorship, and voluntary demographic answers. The adapter does not guess those values or choose an answer automatically.

The exact URL has a provider-regression test. Public page inspection is **not** an authenticated Playwright run or a completed application submission.

## Workday structured work experience

Workday-specific operations are declared in `workday/steps.ts`, with resume re-upload behavior in `workday/resume.ts`. The Workday helper at `workday/experience.ts` fills repeatable **Work Experience** rows from the canonical résumé JSON `experience[]`. It maps company, job title, location, job description, start/end dates and the **I currently work here** checkbox. It prefers an existing matching job row, then an empty row, then a section-scoped **Add** or **Add Another** control. Repeated refreshes do not intentionally duplicate existing jobs.

To prevent incorrect employment claims, the helper never invents days for dates stored as `YYYY` or `YYYY-MM`, never overwrites pre-filled conflicting values, and does not auto-navigate, answer authorization questions, create accounts, or submit. Unrecognized fields/controls are flagged in `missing` for browser review. Workday employers customize these controls, so live behavior for individual employers is **not yet verified**.

Browser fixtures: `npx vitest run tests/workday`. The fixtures are simulated Workday-style forms, **not** authenticated employer sessions.

## Site-defined operations

Adapters declare their own `steps` array of `{ id, matches(context), run(context) }`. There is no shared list of application sections: Workday may declare work history, education or resume steps, while another ATS can define entirely different operations. The orchestrator executes only matching steps in the site's declared order and validates the employer destination before and after every step. Unknown or absent sections are not labeled unsupported and no arbitrary HTML autofill fallback is applied. Screening answers require an adapter-owned handler and explicitly supplied values.

## Floating menu actions

Each site declares only the actions it supports with `menuItems: [{ id, label, stepId }]`. The referenced `stepId` must be a site-owned `steps` entry; no section names or menu actions are enforced by shared code. The browser viewer loads the current session's menu from `GET /api/apply/:id/menu`, checks each action's `matches()` guard, and executes only explicitly selected actions via `POST /api/apply/:id/menu`. Missing steps are never auto-generated. Workday defines its own menu; other providers display no menu until they declare one. The floating pill is draggable by its handle and never submits an application.

## Provider-owned field maps

Workday's contact field definitions live in `workday/field-map.ts` as a
`Map<WorkdayContactField, FieldLocatorConfig>`. `core/field-matcher.ts`
resolves accessible-label candidates in priority order, followed by optional
**verified** CSS fallbacks. To support a changed employer label, add a
provider-specific label alternative and a Playwright fixture instead of editing
the filling algorithm.

The matcher never chooses the first of multiple matches, never targets hidden,
disabled, read-only, password or file inputs, and the Workday autofiller does not
overwrite conflicting existing values. Missing or ambiguous fields are reported
for manual review. Maps only locate controls; the site adapter remains
responsible for form workflow, selects, uploads, and navigation.

Other ATS adapters currently do not implement the same contact autofill step.
Do not add speculative provider selector maps until those steps and fixtures
exist. These fixtures are synthetic DOMs; they do not prove live employer
compatibility.

Run the regression fixtures with
`npx vitest run tests/workday/workday-field-map.test.ts`.
