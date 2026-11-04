# Workflow and release operations

[← README](../README.md) · [Template development](template-development.md)

This repository is the canonical source of **thin workflow callers** in [`.github/workflows/`](../.github/workflows/). Their implementations and the cross-repository synchronization controller are maintained in [moyarich/reusable-workflows](https://github.com/moyarich/reusable-workflows).

## Before enabling releases

> [!CAUTION]
> Templates include **examples**, not production-ready publishing settings. Keep automated release and publish workflows disabled or in dry-run mode until you've reviewed their configuration.

Check the following for each destination repository:

- Package selectors and publishable workspaces
- Release triggers, versioning behavior, and branch names
- Registry credentials, secrets, and workflow permissions
- Build paths and generated distribution files
- Compatibility with upstream publishing workflows

### Important defaults

| Setting                                    | Behavior                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepare-release-pr.yml` version selection | `package-json` (default) uses each selected package's existing declared version without incrementing it; `patch`, `minor`, and `major` are also supported  |
| Workspace Tools CLI source                 | Migrated callers use `checkout:upstream;branch:main`, not `checkout:current`, since this template does not contain Workspace Tools                         |
| `check-dist.yml`                           | Opt-in for projects committing build output; it fails with gitignored package `dist/` directories until you track the output or use an artifact-only check |
| `npm run pack:check`                       | Dry-runs packaging for every npm workspace; narrow the selection if needed                                                                                 |

For reproducible releases, pin a published Workspace Tools CLI version or immutable commit rather than a moving branch.

## Updating callers across repositories

The copy dispatcher in this repository runs **manually**. Merging changes to this template does **not** automatically synchronize other repositories.

1. Update the canonical `.github/workflows/*.yml` caller here and merge your change.
2. Open [Copy files to another repository](https://github.com/moyarich/reusable-workflows-callers/actions/workflows/copy-files-to-another-repository.yml) in this repository.
3. Dispatch with `dry-run: true` to preview the proposed changes. Optionally select a single `owner/repo` destination.
4. When the preview is correct, dispatch with `dry-run: false` to create destination pull requests.
5. Review the destination PRs and CI results before merging.

The default PR mode does **not** directly rewrite a destination's `main` branch.

### How synchronization works

- [Central copy configuration](https://github.com/moyarich/reusable-workflows/blob/main/.github/copy-files-config.yml) defines `source.repository: moyarich/reusable-workflows-callers`, filename patterns, destinations, exclusions, and overrides.
- [The caller-owned copy dispatcher](../.github/workflows/copy-files-to-another-repository.yml) invokes [`reusable_copy-files-to-another-repository.yml`](https://github.com/moyarich/reusable-workflows/blob/main/.github/workflows/reusable_copy-files-to-another-repository.yml).
- [The copier implementation and tests](https://github.com/moyarich/reusable-workflows/tree/main/packages/copy-files-to-another-repository) live upstream.
- Existing selected workflow files are updated. New files require an explicit `create-files` allowlist; removed workflows are **not** deleted.
- Per-repository `exclude` and `overrides` rules stay in the upstream configuration.
- Compatibility checks protect publishing implementations; template package selectors are preserved when the release package choice synchronizer is not selected.

**Do not copy the central destination inventory into this template.** The upstream `.github/copy-files-config.yml` is repository-local and isn't automatically shared with repositories created from the template. A repository independently invoking the copier needs **its own** configuration with an explicit `source.repository`.

### Required permissions

The upstream central caller passes the `_WORKFLOW_TOKEN` secret as `workflow-token`. It must be able to read the source and create commits or PRs updating the selected destination workflow files.

See the [copier operations guide](https://github.com/moyarich/reusable-workflows/blob/main/docs/02-guides/copy-files-to-another-repository.md) for complete configuration and troubleshooting.

## Workflow consumer inventory

Run the private/manual **Inventory reusable workflow consumers** workflow with `workflow_dispatch` to scan default-branch workflows in repositories accessible through `_WORKFLOW_TOKEN`.

The job commits [the generated inventory](workflow-consumers.md) and prints the table in its Actions summary. The token needs read access to the repositories being scanned and write access to this repository.

> [!WARNING]
> Private repositories are excluded by default. Enabling the `include-private` input can publish their names in a **committed Markdown file in this public repository**.

## Related documentation

- [Template development](template-development.md)
- [Generated workflow consumer inventory](workflow-consumers.md)
- [Upstream reusable workflows](https://github.com/moyarich/reusable-workflows)

## Approved preparation PR releases

The `release-approved-pr.yml` caller runs automatically after a same-repository `release/prepare-*` PR is merged into `main`. It also supports **Run workflow** with `pr-number` to validate and replay a previously merged preparation PR. For manual runs, `dry-run` defaults to **true**, previewing GitHub Release drafts without writing them; select `false` only when ready to create or update drafts. Automatic merged-PR runs use `dry-run: false`.

The **Approved release inputs** job validates the merged PR and writes a GitHub Actions job summary with the PR number, title, source branch, merge SHA, reusable workflow, and effective dry-run mode. The reusable workflow is [`reusable_release-approved.yml`](https://github.com/moyarich/reusable-workflows/blob/main/.github/workflows/reusable_release-approved.yml). Reset/restore callers use the upstream bulk workflows, which in turn invoke `reusable_release-reset.yml` and `reusable_release-restore.yml`.
