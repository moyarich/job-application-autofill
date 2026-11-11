# resume-ocr

Installable Python package for PDF text extraction with OCR fallback. PDFium reads
selectable text; RapidOCR recovers text from scanned pages. Python 3.12–3.14 is supported.

```text
PDF Resume
    │
    ▼
pypdfium2
    │
    ├── Selectable text → Extract directly
    │
    └── Scanned page → Render as image
                              │
                              ▼
                           RapidOCR
                              │
                              ▼
                         ONNX Runtime
                              │
                              ▼
                        Recognized text
```
       
## Install

From the repository root, install into your Python environment:

```sh
python -m pip install ./packages/resume-ocr
```

For development, run these commands inside `packages/resume-ocr`:

```sh
poetry install --with test
poetry build
```

Poetry builds a wheel and source distribution in `dist/`. Repository-wide Python
provisioning is also available through `npm run build:python`; that build script
lives outside this Python package. It runs `poetry build --format wheel`, then
installs the wheel and the API's pinned requirement into the repository-root `.venv`.

## Source modules

- `extract.py` coordinates page extraction and the OCR fallback.
- `text.py` reads selectable text and restores drawn list markers.
- `ocr.py` renders scanned pages and invokes RapidOCR.
- `settings.py` defines extraction limits and defaults.
- `cli.py` owns argument parsing, JSON output, and exit codes.
- `__main__.py` supports `python -m resume_ocr`.

## CLI

```sh
resume-ocr /path/to/resume.pdf
python -m resume_ocr /path/to/resume.pdf
```

Both commands write JSON with `text`, `ocrPages`, and `pageCount`.

## Python API

```python
from pathlib import Path
from resume_ocr import extract_pdf

result = extract_pdf(Path("resume.pdf"))
print(result["text"])
```

## Node integration

`@moyarich/resume` owns DOCX extraction, profile parsing, and the user-facing
`extract-resume` CLI. For PDFs it invokes `python -m resume_ocr` using the installed
package. Set `PYTHON_EXECUTABLE` to the interpreter where the package is installed.
Runtime code does not locate a source checkout or discover a Poetry environment.

`resume-api` pins the Python dependency in its `requirements.txt`. The Docker
build creates a wheel and installs it into `/opt/resume-ocr`; the runtime image
contains no `packages/resume-ocr` directory. The Node API owns HTTP handling.

## Tests

```sh
poetry run python -m unittest discover -s tests -p 'test_*.py' -v
```

This package contains Python source and packaging configuration; it has no npm
package, TypeScript source, or Vite build.
