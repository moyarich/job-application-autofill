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
