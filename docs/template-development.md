# Template development

[← README](../README.md) · [Workflow and release operations](workflow-operations.md)

Use this guide to customize and test a repository created from the template.

## Project layout

| Path                                 | Role                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `packages/job-application-autofill/` | Job application autofill package                            |
| `apps/playground/`                   | Vite + React app consuming the autofill package             |
| `.github/workflows/`                 | Thin CI, release, publish, and maintenance workflow callers |
| `eslint.config.mjs`                  | Shared ESLint flat configuration and Prettier compatibility |
| `tsconfig.json`                      | Shared TypeScript defaults                                  |
| `vitest.config.ts`                   | Unit test discovery                                         |
| `playwright.config.ts`               | End-to-end test configuration                               |
| `.storybook/`                        | Storybook configuration                                     |

## Start developing

```sh
npm install
npm run dev
```

The root scripts use npm's built-in `--workspaces --if-present` support instead of a custom workspace runner. Development uses the conventional `apps/playground` path rather than a hardcoded workspace package name. Vite handles individual workspace builds and the playground development server.

To adapt this template:

1. Rename the `@template/*` workspaces and replace the example code.
2. Add libraries under `packages/*` and apps under `apps/*`.
3. Give each workspace its own applicable `build`, `typecheck`, and `test` scripts.
4. Keep shared logic in packages and application examples in playgrounds.
5. Configure registry publishing only for packages you actually intend to release.

## Commands

| Command                   | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `npm run dev`             | Start development in configured workspaces          |
| `npm run build`           | Build workspaces with build scripts                 |
| `npm test`                | Run the root Vitest test command                    |
| `npm run test:unit`       | Run unit tests via `vitest.config.ts`               |
| `npm run test:watch`      | Run workspace watch scripts, where present          |
| `npm run typecheck`       | Run workspace checks plus root TypeScript check     |
| `npm run lint`            | Run ESLint                                          |
| `npm run format:check`    | Check formatting with Prettier                      |
| `npm run checks`          | Run formatting, lint, type checks, tests, and build |
| `npm run pack:check`      | Dry-run npm package creation for all workspaces     |
| `npm run storybook`       | Start Storybook                                     |
| `npm run build:storybook` | Build Storybook                                     |
| `npm run test:e2e`        | Run Playwright tests                                |

`npm run pack:check` includes **every configured workspace**. Change the workspace selection if only publishable packages should be packed.

## Testing and stories

### Unit tests

Vitest discovers `*.test.*` files in root, package, and application test directories.

```sh
npm run test:unit
```

### End-to-end tests

Playwright discovers `*.spec.*` files. Its configuration starts the Vite playground on port **4173**.

```sh
npx playwright install chromium
npm run test:e2e
```

The Playwright CI caller runs on `main`, manual dispatch, and pull requests affecting specs or configuration. Adjust fixtures and `webServer` options in `playwright.config.ts` for your project. No separate CI-specific package script is required.

### Storybook

Storybook scans stories in application, package, and source directories.

```sh
npm run storybook
npm run build:storybook
```

Storybook is a development-only tool and isn't part of the published example package.

## Next step

Before using release or publishing workflows, read [Workflow and release operations](workflow-operations.md).
