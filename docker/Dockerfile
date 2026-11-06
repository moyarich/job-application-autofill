# Same immutable app image is shared by web and API services.
# Playwright base image includes Chromium and operating-system browser dependencies.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    XKEYSYMDB=/etc/X11/XKeysymDB \
    POETRY_VIRTUALENVS_IN_PROJECT=false \
    POETRY_VIRTUALENVS_PATH=/opt/poetry-venvs

# All app dependencies are in Ubuntu main/universe. Do not fetch the restricted
# and multiverse indices: the ARM64 noble-security/restricted index caused a
# mirror publication mismatch even though the app installs nothing from it.
# Keep the signed Ubuntu repositories and all security/update pockets intact.
RUN set -eu; \
    sources=/etc/apt/sources.list.d/ubuntu.sources; \
    test -f "$sources"; \
    sed -i -E 's/^Components: .*/Components: main universe/' "$sources"; \
    grep -q '^Components: main universe$' "$sources"; \
    ! grep -Eq '^Components: .*\b(restricted|multiverse)\b' "$sources"; \
    apt-get -o APT::Update::Error-Mode=any update; \
    apt-get install -y --no-install-recommends python3 python3-venv python3-pip pipx xvfb x11vnc x11-xkb-utils xkb-data libx11-data fluxbox novnc websockify fonts-noto-core fonts-noto-cjk fonts-noto-extra fonts-noto-color-emoji; \
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
COPY packages/resume/package.json packages/resume/package.json
COPY packages/resume-api/package.json packages/resume-api/package.json
COPY packages/job-sites/package.json packages/job-sites/package.json
RUN npm ci --include=optional --no-audit --no-fund
RUN npx playwright install chromium

# Install the Python OCR environment with Poetry, separate from Node.
COPY packages/resume/pyproject.toml packages/resume/pyproject.toml
COPY packages/resume/README.md packages/resume/README.md
COPY packages/resume/poetry.lock packages/resume/poetry.lock
RUN cd packages/resume \
    && poetry config virtualenvs.create true \
    && poetry install --only main --no-root \
    && poetry env info --path > /tmp/moya-venv-path \
    && test -f "$(cat /tmp/moya-venv-path)/pyvenv.cfg" \
    && ln -s "$(cat /tmp/moya-venv-path)" /opt/venv \
    && /opt/venv/bin/python -c "import sys; assert sys.prefix == '/opt/venv', (sys.prefix, sys.executable)" \
    && /opt/venv/bin/python -c "import pypdfium2; from rapidocr import RapidOCR; import onnxruntime; from PIL import Image"

# Dependency import check runs with the same interpreter used by the API above.

COPY . .
RUN npm run build:js --workspace packages/resume
RUN chmod +x docker/start-review.sh


EXPOSE 4177 5173 6080
CMD ["node", "packages/resume-api/index.mjs"]
