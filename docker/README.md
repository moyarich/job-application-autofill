# Docker development

Start the project in development mode from the repository root:

```bash
npm run dev
```

The script runs:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

The development override mounts the local checkout at `/app` in both the API and
web containers, while keeping image-installed `node_modules` and the prebuilt
`packages/resume/dist` available in container-managed volumes. The image and existing dependency volumes are reused on normal startup. Missing images are built automatically by Compose on the first run.

- React/Vite changes update in the browser through HMR (polling enabled for Docker Desktop).
- API TypeScript changes restart the Node process using `node --watch`.
- The API starts `start-review.sh` via Bash because bind-mounted host scripts may not be executable.
- SQLite persists on the host at `./sqlite-data`, not inside the source image.
- Changes to dependencies, the Dockerfile or compiled resume code require an explicit rebuild: `npm run dev -- --build`. This refreshes the dependency volumes only when requested.
- Changes to the `@moyarich/resume` package's `src` need a rebuild of its
  compiled `dist` output; that package is not independently watched in dev mode.
  The explicit rebuild command also refreshes `/app/packages/resume/dist`.

**First run:** Docker must still download the Playwright base image (a large download). Subsequent starts reuse the local image unless you explicitly rebuild or delete Docker's image cache.

For an image-based (non-live-reload) run, use the original Compose file only:

```bash
docker compose -f docker-compose.yml up -d --build
```

This does not bind-mount the local source tree. Do not run `docker compose down -v`
as part of normal updates: it removes Docker-managed volumes, including screenshots.
