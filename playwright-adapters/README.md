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
