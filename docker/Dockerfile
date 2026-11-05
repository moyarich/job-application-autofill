# Same immutable app image is shared by web and API services.
# Playwright base image includes Chromium and operating-system browser dependencies.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=false \
    POETRY_VIRTUALENVS_PATH=/opt/poetry-venvs

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip pipx \
    && rm -rf /var/lib/apt/lists/*

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
    && poetry env info --executable > /tmp/moya-python-path \
    && mkdir -p /opt/venv/bin \
    && ln -s "$(cat /tmp/moya-python-path)" /opt/venv/bin/python

COPY . .

# Ensure browser binaries match npm's Playwright dependency.
RUN npx playwright install chromium

EXPOSE 4177 5173
CMD ["node", "server/index.mjs"]
