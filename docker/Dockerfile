# The browser-free development frontend and the API share cached npm dependencies,
# but only the API installs Python, Chromium, and the graphical VNC stack.
FROM node:22-bookworm-slim AS node-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/playground/package.json apps/playground/package.json
COPY packages/job-application-autofill/package.json packages/job-application-autofill/package.json
COPY packages/resume/package.json packages/resume/package.json
COPY packages/resume-api/package.json packages/resume-api/package.json
COPY packages/job-sites/package.json packages/job-sites/package.json
RUN npm ci --include=optional --no-audit --no-fund

FROM node-deps AS build
COPY . .
RUN npm run build:js --workspace packages/resume

# Vite only needs Node.js, source code and prebuilt workspace packages.
FROM build AS web
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "packages/job-application-autofill"]

# Python 3.14.10 is the newest supported release for the OCR dependency stack.\n# ONNX Runtime does not currently publish Python 3.15 wheels.
# Both bases use Debian bookworm, so the Node binary is ABI-compatible.
FROM python:3.14.10-slim-bookworm AS api
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    XKEYSYMDB=/etc/X11/XKeysymDB \
    POETRY_VIRTUALENVS_IN_PROJECT=false \
    POETRY_VIRTUALENVS_PATH=/opt/poetry-venvs

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       xvfb x11vnc x11-xkb-utils xkb-data libx11-data fluxbox \
       novnc websockify \
       fonts-noto-core fonts-noto-cjk fonts-noto-extra fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Copy Node 22 and npm from the slim Node stage instead of installing
# a second complete browser/Node distribution in the API image.
COPY --from=node-deps /usr/local/bin/node /usr/local/bin/node
COPY --from=node-deps /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

WORKDIR /app
COPY --from=node-deps /app /app

# Install only Chromium (headed and headless) with Playwright-managed versions.
# Browser dependencies are resolved against Debian bookworm, not Ubuntu Noble.
RUN npx --no-install playwright install --with-deps chromium

# Install the OCR environment only in the API image. Keep this above the
# application COPY so editing React or API source never reinstalls Python.
RUN python -m pip install --no-cache-dir "poetry==2.2.1"
COPY packages/resume/pyproject.toml packages/resume/pyproject.toml
COPY packages/resume/README.md packages/resume/README.md
COPY packages/resume/poetry.lock packages/resume/poetry.lock
RUN cd packages/resume \
    && poetry config virtualenvs.create true \
    && poetry install --only main --no-root \
    && poetry env info --path > /tmp/moya-venv-path \
    && test -f "$(cat /tmp/moya-venv-path)/pyvenv.cfg" \
    && ln -s "$(cat /tmp/moya-venv-path)" /opt/venv \
    && /opt/venv/bin/python -c "import sys; assert sys.prefix == '/opt/venv' and sys.version_info[:2] == (3, 14), (sys.prefix, sys.version)" \
    && /opt/venv/bin/python -c "import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image"

# Keep host-side X11 keyboard mappings and the runtime source available.
COPY docker/XKeysymDB /etc/X11/XKeysymDB
COPY . .
COPY --from=build /app/packages/resume/dist /app/packages/resume/dist
RUN chmod +x docker/start-review.sh

EXPOSE 4177 6080
CMD ["node", "--experimental-strip-types", "packages/resume-api/index.ts"]
