# Playwright ATS adapters

Each provider has its own field-mapping module:

- `greenhouse/index.mjs`
- `lever/index.mjs`
- `workday/index.mjs`
- `ashby/index.mjs`
- `smart-recruiters/index.mjs`

The shared `index.mjs` selects adapters from the job URL and implements form-state detection, read-only question discovery, and autofill using only explicit candidate answers. Login, SSO, MFA, and CAPTCHA require manual browser interaction.

Run the five-provider fixture checks with `node --test tests/ats-browser.test.mjs`.

These are adapter foundations; individual employers can customize their workflows and still require browser review.

## Real-world Workday URL example

[Elevance Health — Developer Senior (JR209310)](https://elevancehealth.wd1.myworkdayjobs.com/en-US/ANT/job/IL-CHICAGO-8600-W-BRYN-MAWR-AVE-10th--11th-FL/Developer-Senior_JR209310) uses the `workday/` adapter because the hostname is `elevancehealth.wd1.myworkdayjobs.com`, **not** Greenhouse.

This URL is included in the adapter classification regression test. Live sign-in, step transitions and employer submission have **not** been verified; only a public listing could be confirmed independently. A listing may require clicking **Apply** and completing an account login before form controls are available.

## Smartsheet — real Greenhouse example

[Sr. Software Engineer I (Remote Eligible), job 8250247](https://job-boards.greenhouse.io/smartsheet/jobs/8250247) is hosted on `job-boards.greenhouse.io`, so it uses `playwright-adapters/greenhouse/`.

Publicly visible application fields include first and last name, **preferred first name**, email, country/phone, city, résumé upload, education, applicant privacy notice, referral relationship, source, LinkedIn, AI familiarity, U.S. work authorization and future sponsorship. These fields vary by employer and change over time.

**Manual review is required** for unprovided preferred name, country/autocomplete, education dropdowns, consent, referral/screening questions, authorization/sponsorship, and voluntary demographic answers. The adapter does not guess those values or choose an answer automatically.

The exact URL has a provider-regression test. Public page inspection is **not** an authenticated Playwright run or a completed application submission.

## Workday structured work experience

The Workday helper at `workday/experience.mjs` fills repeatable **Work Experience** rows from the canonical résumé JSON `experience[]`. It maps company, job title, location, job description, start/end dates and the **I currently work here** checkbox. It prefers an existing matching job row, then an empty row, then a section-scoped **Add** or **Add Another** control. Repeated refreshes do not intentionally duplicate existing jobs.

To prevent incorrect employment claims, the helper never invents days for dates stored as `YYYY` or `YYYY-MM`, never overwrites pre-filled conflicting values, and does not auto-navigate, answer authorization questions, create accounts, or submit. Unrecognized fields/controls are flagged in `missing` for browser review. Workday employers customize these controls, so live behavior for individual employers is **not yet verified**.

Browser fixtures: `node --test tests/workday-experience.test.mjs`. The fixtures are simulated Workday-style forms, **not** authenticated employer sessions.
