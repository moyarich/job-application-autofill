# Reusable Workflows Callers

A GitHub repository template for **npm-workspaces monorepos**, with example TypeScript and React projects and ready-to-adapt GitHub Actions workflow callers.

This repository contains the **caller workflows**. Their shared implementations live in [moyarich/reusable-workflows](https://github.com/moyarich/reusable-workflows).

## Quick start

Create a repository using **[Use this template](https://github.com/new?template_owner=moyarich&template_name=reusable-workflows-callers)**, clone it, and run:

```sh
npm install
npm run dev
```

Run the main checks before committing:

```sh
npm run checks
```

Then rename the `@template/*` workspaces, replace the sample code, and review the workflow configuration **before enabling releases or publishing**.

## What's included?

| Location                                   | What you'll find                    |
| ------------------------------------------ | ----------------------------------- |
| [`packages/example/`](packages/example/)   | Example TypeScript library          |
| [`apps/playground/`](apps/playground/)     | Vite + React playground             |
| [`.github/workflows/`](.github/workflows/) | CI, release and maintenance callers |
| [`docs/`](docs/)                           | Setup and operations guides         |

## Common commands

| Command              | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Start workspace development                           |
| `npm run checks`     | Run formatting, linting, type checks, tests and build |
| `npm run test:unit`  | Run Vitest unit tests                                 |
| `npm run test:e2e`   | Run Playwright end-to-end tests                       |
| `npm run storybook`  | Open Storybook                                        |
| `npm run pack:check` | Dry-run packaging for all workspaces                  |

See [Template development](docs/template-development.md) for setup, test prerequisites and configuration.

## Guides

- **[Template development](docs/template-development.md)** — project layout, adapting packages, scripts, testing, and Storybook.
- **[Workflow and release operations](docs/workflow-operations.md)** — release setup, safety checks, caller synchronization, and troubleshooting.
- **[Workflow consumer inventory](docs/workflow-consumers.md)** — generated inventory of repositories consuming reusable workflows.

> [!IMPORTANT]
> This is a **template**, not a ready-to-publish application. Review package selection, release triggers, publishing credentials, and workflow permissions before using release jobs. The workflow synchronization controller and destination inventory are maintained [upstream](https://github.com/moyarich/reusable-workflows), not in this repository.
