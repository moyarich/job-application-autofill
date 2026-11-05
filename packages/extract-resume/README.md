# @moyarich/extract-resume

Local Node.js resume extraction package used by MoyaApply. Supports PDF and DOCX uploads and structured profile heuristics. No cloud services.

## API

```js
import { decodeUpload, extractResumeText, extractProfile } from "@moyarich/extract-resume";

const upload = decodeUpload({ fileName: "resume.pdf", base64: pdfBase64 });
const text = await extractResumeText(upload.buffer, upload.extension);
const profile = { ...extractProfile(text), resumeFileName: upload.fileName };
```

- PDF: Python `pypdfium2` extracts embedded text; `RapidOCR` + ONNX Runtime extracts scanned pages lazily.
- DOCX: built-in Node ZIP decompression and document XML extraction.
- Profile: heuristic extraction of contact details and known skills; results should be reviewed.

The Python OCR environment is managed with Poetry using `pyproject.toml` (package mode disabled because the reusable Node.js workspace owns distribution).

## Python setup

```sh
cd packages/extract-resume
poetry install --with test --no-root
cd ../..
PYTHON_EXECUTABLE="$(cd packages/extract-resume && poetry env info --executable)" npm run dev:server
```

## Tests

```sh
cd packages/extract-resume
poetry run python -m unittest discover -s python -p 'test_*.py' -v
npm test
```

PDF OCR is limited to 30 pages / 10 MB, rendering insufficient-text pages at 250 DPI. The OCR module runs as a local Python child process with a 120-second timeout.
