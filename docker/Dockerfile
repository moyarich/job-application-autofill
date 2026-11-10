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

# Only the API needs headed/headless Chromium and the X11/noVNC viewer.
FROM build AS api
ENV DEBIAN_FRONTEND=noninteractive \
    XKEYSYMDB=/etc/X11/XKeysymDB
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       xvfb x11vnc x11-xkb-utils xkb-data libx11-data fluxbox \
       novnc websockify \
       fonts-noto-core fonts-noto-cjk fonts-noto-extra fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
RUN npx --no-install playwright install --with-deps chromium
COPY docker/XKeysymDB /etc/X11/XKeysymDB
RUN chmod +x docker/start-review.sh
EXPOSE 4177 6080
CMD ["node", "--experimental-strip-types", "packages/resume-api/index.ts"]

# PDFium, RapidOCR, ONNX Runtime, and Python exist only in this image.
# The OCR API uses a private Compose network and has no published host ports.
FROM python:3.14.10-slim-bookworm AS ocr
ENV PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=false \
    POETRY_VIRTUALENVS_PATH=/opt/poetry-venvs
WORKDIR /app/packages/resume
RUN python -m pip install --no-cache-dir "poetry==2.2.1"
COPY packages/resume/pyproject.toml packages/resume/README.md packages/resume/poetry.lock ./
RUN poetry config virtualenvs.create true \
    && poetry install --only main --no-root \
    && poetry env info --path > /tmp/moya-venv-path \
    && ln -s "$(cat /tmp/moya-venv-path)" /opt/venv \
    && /opt/venv/bin/python -c "import sys, pypdfium2, onnxruntime; from rapidocr import RapidOCR; from PIL import Image; assert sys.version_info[:2] == (3, 14)"
COPY packages/resume/python/pdf_ocr.py packages/resume/python/ocr_service.py ./python/
RUN useradd --system --uid 10001 --no-create-home ocr
USER ocr
EXPOSE 8765
CMD ["/opt/venv/bin/python", "python/ocr_service.py"]
