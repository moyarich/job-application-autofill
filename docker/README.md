# Docker development

Start the project from the repository root:

```sh
npm run dev
```

This runs the API and frontend with the development Compose override. The local
checkout is mounted at `/app`; dependencies and workspace build outputs stay in
container-managed volumes. Startup refreshes npm workspace links offline before
building the JavaScript packages. Vite watches the API and frontend source.

The API image includes Node 22, Playwright Chromium, Xvfb/noVNC, Python 3.14.10,
and the installed `resume-ocr` package. `packages/resume-api/requirements.txt` pins
its version. A separate build stage creates a wheel, installs locked dependencies,
and installs the wheel without an editable source link. Only the Python runtime
and installed environment are copied to the API image. The Python source project
is absent from the production runtime image and is not needed during extraction.

The Node API handles HTTP and invokes `python -m resume_ocr` as a subprocess.
`PYTHON_EXECUTABLE` points to `/opt/resume-ocr/bin/python`. There is no separate OCR
service or OCR network. The frontend contains no Python, Chromium, or OCR runtime.

SQLite persists at `./sqlite-data`; screenshots use their existing volume.
API source changes trigger a Vite rebuild and server restart. Changes to resume
or job-board source require restarting to rebuild workspace outputs. Changes to
Python dependencies or code require an API image rebuild:

```sh
npm run dev -- --build
```

An image-based run without source mounts uses the base Compose file:

```sh
docker compose -f docker-compose.yml up -d --build
```

Normal updates should preserve the SQLite and screenshot volumes.
