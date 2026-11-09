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
`packages/resume/dist` available in container-managed volumes. The API and frontend share cached npm build layers. A third, dedicated Python 3.14 OCR image contains PDFium, RapidOCR and ONNX Runtime. Existing images and dependency volumes are reused on normal startup; missing images are built automatically by Compose.

- The slim frontend image includes Node and Vite, **not** Python, Chromium, OCR, or noVNC. React/Vite changes update in the browser through HMR (polling enabled for Docker Desktop).
- API TypeScript changes restart the Node process using `node --watch`.
- The API image uses Node 22, Playwright-managed Chromium and the Xvfb/Fluxbox/x11vnc/noVNC stack (no Python OCR dependencies). The API starts `start-review.sh` via Bash because bind-mounted host scripts may not be executable.
- The OCR service runs Python 3.14.10 in a private, unexposed network (`ocr-private`), accepts PDF bytes from the API over HTTP, and runs with a 2 GiB memory and 2 CPU limit. The Node API uses `OCR_SERVICE_URL`; standalone local CLI parsing still uses the Python subprocess.
- SQLite persists on the host at `./sqlite-data`, not inside the source image.
- Changes to dependencies, the Dockerfile or compiled resume code require an explicit rebuild: `npm run dev -- --build`. This refreshes the dependency volumes only when requested.
- Changes to the `@moyarich/resume` package's `src` need a rebuild of its
  compiled `dist` output; that package is not independently watched in dev mode.
  The explicit rebuild command also refreshes `/app/packages/resume/dist`.

Python 3.14 is the newest supported runtime for OCR today. Python 3.15 is stable, but ONNX Runtime has not published compatible CPython 3.15 wheels. The Poetry constraint remains `>=3.12,<3.15` to reflect supported interpreters.\n\n**First run:** Docker downloads the smaller Node 22 and Python 3.14.10 bookworm-slim base images. The API installs Chromium and its operating-system dependencies. The OCR image installs its own Python requirements separately. The Chromium download is still substantial, but neither the web nor the API image carries the heavy OCR stack. Subsequent starts reuse these images unless you explicitly rebuild or delete Docker's image cache.

To inspect the resulting image sizes after building, run `docker image ls --filter reference='job-application-autofill-*'`.

For an image-based (non-live-reload) run, use the original Compose file only:

```bash
docker compose -f docker-compose.yml up -d --build
```

This does not bind-mount the local source tree. Do not run `docker compose down -v`
as part of normal updates: it removes Docker-managed volumes, including screenshots.
