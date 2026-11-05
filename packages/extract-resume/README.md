# @moyarich/extract-resume

Local Node.js resume extraction package used by job-application-autofill. Supports PDF and DOCX uploads and structured profile heuristics. No cloud services.

The parser produces the [standalone résumé data contract](../../resume-schema/resume.schema.json), shared with the application but **owned separately from this optional extractor**. See the [example JSON](../../resume-schema/resume.example.json).

## API

```js
import { decodeUpload, extractResumeText, extractProfile } from "@moyarich/extract-resume";

const upload = decodeUpload({ fileName: "resume.pdf", base64: pdfBase64 });
const text = await extractResumeText(upload.buffer, upload.extension);
const profile = { ...extractProfile(text), source: { fileName: upload.fileName } };
```

- PDF: Python `pypdfium2` extracts embedded text; `RapidOCR` + ONNX Runtime extracts scanned pages lazily.
- DOCX: built-in Node ZIP decompression and document XML extraction.
- Profile: heuristic extraction of contact, skills and dated employment history into standalone schema fields; results should be reviewed.

The Python OCR environment is managed with Poetry using `pyproject.toml` (package mode disabled because the reusable Node.js workspace owns distribution).

## Python setup

**Recommended:** run `npm run dev` at the repository root. The Docker image installs and verifies `pypdfium2`, `rapidocr`, ONNX Runtime and Pillow during its build. You do **not** need to install these packages on your host computer.

When running the Node API directly on the host, PDF extraction discovers a usable Poetry virtualenv or system Python. If no interpreter contains the PDF/OCR dependencies, it attempts `poetry install --only main --no-root` in this package automatically (Poetry must be installed). DOCX and imported résumé JSON do not require Python.

To install the optional Python test dependencies manually:

```sh
cd packages/extract-resume
poetry install --with test --no-root
```

If you explicitly set `PYTHON_EXECUTABLE`, it **must** point to an interpreter containing `pypdfium2`, `rapidocr`, `onnxruntime` and `Pillow`. Invalid overrides now fail with an actionable configuration error rather than accidentally invoking a different Python.

## Tests

```sh
cd packages/extract-resume
poetry run python -m unittest discover -s python -p 'test_*.py' -v
npm test
```

PDF OCR is limited to 30 pages / 10 MB, rendering insufficient-text pages at 250 DPI. The OCR module runs as a local Python child process with a 120-second timeout.
