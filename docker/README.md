# Docker development

Start the project in development mode from the repository root:

```bash
npm run dev
```

The script runs:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --renew-anon-volumes
```

The development override mounts the local checkout at `/app` in both the API and
web containers, while keeping image-installed `node_modules` and the prebuilt
`packages/resume/dist` available in container-managed volumes. Anonymous dependency volumes are renewed on startup.

- React/Vite changes update in the browser through HMR (polling enabled for Docker Desktop).
- API TypeScript changes restart the Node process using `node --watch`.
- SQLite persists on the host at `./sqlite-data`, not inside the source image.
- Changes to dependencies or the Dockerfile still require rebuilding the image.
- Changes to the `@moyarich/resume` package's `src` need a rebuild of its
  compiled `dist` output; that package is not independently watched in dev mode.
  Recreate the `/app/packages/resume/dist` volume after rebuilding if necessary.

For an image-based (non-live-reload) run, use the original Compose file only:

```bash
docker compose -f docker-compose.yml up -d --build
```

This does not bind-mount the local source tree. Do not run `docker compose down -v`
as part of normal updates: it removes Docker-managed volumes, including screenshots.
