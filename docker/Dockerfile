# Build a versioned wheel and install it without an editable/source-directory link.
FROM python:3.14.10-slim-bookworm AS python-base
FROM python-base AS ocr-package
WORKDIR /build/resume-ocr
RUN python -m pip install --no-cache-dir "poetry==2.2.1" \
    && python -m venv /opt/resume-ocr
ENV VIRTUAL_ENV=/opt/resume-ocr \
    POETRY_VIRTUALENVS_CREATE=false
COPY packages/resume-ocr/pyproject.toml packages/resume-ocr/README.md packages/resume-ocr/poetry.lock ./
COPY packages/resume-ocr/resume_ocr ./resume_ocr
COPY packages/resume-api/requirements.txt /build/api-requirements.txt
RUN poetry install --only main --no-root --no-interaction \
    && poetry build --format wheel --output /wheels \
    && /opt/resume-ocr/bin/python -m pip install --no-deps --no-index --find-links=/wheels -r /build/api-requirements.txt \
    && cd /tmp \
    && /opt/resume-ocr/bin/python -c "import resume_ocr, pypdfium2, onnxruntime; from rapidocr import RapidOCR; from PIL import Image; assert resume_ocr.__file__.startswith('/opt/resume-ocr/')"

# The browser-free development frontend and the API share cached npm dependencies,
# but only the API installs Python, Chromium, and the graphical VNC stack.
FROM node:22-bookworm-slim AS node-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/playground/package.json apps/playground/package.json
COPY packages/job-application-autofill/package.json packages/job-application-autofill/package.json
COPY packages/resume/package.json packages/resume/package.json
COPY packages/resume-api/package.json packages/resume-api/package.json
COPY packages/job-boards/package.json packages/job-boards/package.json
RUN npm ci --include=optional --no-audit --no-fund

FROM node-deps AS build
COPY . .
RUN npm run build:js

# Vite only needs Node.js, source code and prebuilt workspace packages.
FROM build AS web
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "packages/job-application-autofill"]

# Only the API needs headed/headless Chromium and the X11/noVNC viewer.
FROM build AS api
ENV DEBIAN_FRONTEND=noninteractive \
    XKEYSYMDB=/etc/X11/XKeysymDB \
    PYTHON_EXECUTABLE=/opt/resume-ocr/bin/python
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libbz2-1.0 libdb5.3 libexpat1 libffi8 libgomp1 liblzma5 libncursesw6 libreadline8 libsqlite3-0 libssl3 libuuid1 zlib1g \
       xvfb x11vnc x11-xkb-utils xkb-data libx11-data fluxbox \
       novnc websockify \
       fonts-noto-core fonts-noto-cjk fonts-noto-extra fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
RUN npx --no-install playwright install --with-deps chromium
COPY --from=python-base /usr/local/ /usr/local/
COPY --from=ocr-package /opt/resume-ocr /opt/resume-ocr
RUN ldconfig && rm -rf /app/packages/resume-ocr \
    && /opt/resume-ocr/bin/python -c "import resume_ocr, pypdfium2, onnxruntime; from rapidocr import RapidOCR"
COPY docker/XKeysymDB /etc/X11/XKeysymDB
RUN chmod +x docker/start-review.sh
EXPOSE 4177 6080
CMD ["node", "packages/resume-api/dist/index.js"]
