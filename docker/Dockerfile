# Same immutable app image is shared by web and API services.
# Playwright base image includes Chromium and operating-system browser dependencies.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    XKEYSYMDB=/etc/X11/XKeysymDB \
    POETRY_VIRTUALENVS_IN_PROJECT=false \
    POETRY_VIRTUALENVS_PATH=/opt/poetry-venvs

# ARM64 Ubuntu mirrors occasionally serve inconsistent indices during publication.
# Retry with a fresh index each time; never ignore invalid hashes or reuse stale lists.
RUN set -eu; \
    for attempt in 1 2 3 4 5; do \
      rm -rf /var/lib/apt/lists/*; \
      if apt-get -o APT::Update::Error-Mode=any -o Acquire::Retries=3 update; then \
        break; \
      fi; \
      if [ "$attempt" -eq 5 ]; then \
        echo "APT indexes remain inconsistent after 5 attempts" >&2; \
        exit 1; \
      fi; \
      echo "APT mirror update failed (attempt $attempt/5); retrying with fresh indexes" >&2; \
      sleep "$((attempt * 10))"; \
    done; \
    apt-get -o Acquire::Retries=3 install -y --no-install-recommends python3 python3-venv python3-pip pipx xvfb x11vnc x11-xkb-utils xkb-data libx11-data fluxbox novnc websockify fonts-noto-core fonts-noto-cjk fonts-noto-extra fonts-noto-color-emoji; \
    rm -rf /var/lib/apt/lists/*

# Extend Xlib's keysym-name lookup with newer XF86 names used by xkb-data.
# xkbcomp inherits XKEYSYMDB from Xvfb at runtime; this does not change key layouts.
COPY docker/XKeysymDB /etc/X11/XKeysymDB

RUN pipx install poetry && ln -s /root/.local/bin/poetry /usr/local/bin/poetry

WORKDIR /app

# Install Node dependencies from the workspace lockfile.
COPY package.json package-lock.json ./
COPY apps/playground/package.json apps/playground/package.json
COPY packages/job-application-autofill/package.json packages/job-application-autofill/package.json
COPY packages/extract-resume/package.json packages/extract-resume/package.json
RUN npm ci --include=optional --no-audit --no-fund

# Install the Python OCR environment with Poetry, separate from Node.
COPY packages/extract-resume/pyproject.toml packages/extract-resume/pyproject.toml
COPY packages/extract-resume/README.md packages/extract-resume/README.md
RUN cd packages/extract-resume \
    && poetry config virtualenvs.create true \
    && poetry install --only main --no-root \
    && poetry env info --path > /tmp/moya-venv-path \
    && test -f "$(cat /tmp/moya-venv-path)/pyvenv.cfg" \
    && ln -s "$(cat /tmp/moya-venv-path)" /opt/venv \
    && /opt/venv/bin/python -c "import sys; assert sys.prefix == '/opt/venv', (sys.prefix, sys.executable)" \
    && /opt/venv/bin/python -c "import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image"

# Dependency import check runs with the same interpreter used by the API above.

COPY . .
RUN chmod +x docker/start-review.sh

# Ensure browser binaries match npm's Playwright dependency.
RUN npx playwright install chromium

EXPOSE 4177 5173 6080
CMD ["node", "server/index.mjs"]
