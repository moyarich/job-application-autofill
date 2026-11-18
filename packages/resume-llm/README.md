# resume-llm

Extract a résumé profile locally with Qwen2.5 and validate it against a caller-supplied JSON Schema. The package reads PDFs with a text layer and UTF-8 text files. For scanned documents, provide OCR text as input.

Install with Poetry from this directory.

```sh
poetry install
```

Pass the input document and schema path explicitly. The first run can download the public checkpoint. Use `--offline` after it is cached.

```sh
poetry run resume-llm --schema /path/to/resume.schema.json /path/to/resume.pdf
poetry run resume-llm --schema /path/to/resume.schema.json --offline - < resume.txt
poetry run resume-llm --schema /path/to/resume.schema.json --print-schema
```

The output includes contact, summary, experience, skills, education, projects, certifications, languages, awards, extra sections, and source information. Missing values use the schema's empty representation. The extractor preserves unresolved work entries as an additional section.

Load the model once to process multiple documents.

```python
from resume_llm import ResumeExtractor

extractor = ResumeExtractor.from_schema_file("/path/to/resume.schema.json", offline=True)
profile = extractor.extract_file("resume.pdf")
```

Omit the input file to extract a single employment header from standard input. The Python API for this operation is `EmploymentHeaderExtractor`.

## Local HTTP service

From the repository root, start the service in the Python environment where
`resume-llm` is installed.

```sh
python -m resume_llm.server --schema packages/resume/src/resume-schema/resume.schema.json
```

Add `--offline` to use a cached model. The service loads Qwen at startup and
reuses it to handle requests serially. The Node API sends extracted resume text
as `{"text":"..."}` to `POST http://127.0.0.1:4178/parse` by default and
receives a schema-validated resume. Set `RESUME_LLM_URL` only if the API needs a
different endpoint, such as the address of a service on a private container network.
Bind the service to loopback or a private network because requests contain resume data.
