# MoyaApply resume data contract

This directory defines the **canonical résumé JSON format**, independent of PDF/DOCX extraction.
Import any JSON file conforming to [resume.schema.json](resume.schema.json) in the dashboard under **Candidate profile → Import JSON**.
The user may fill it manually, export it from another tool, or generate it via the optional `@moyarich/extract-resume` parser.

The application API accepts the JSON as `profile` in `POST /api/apply/prepare`. A PDF or DOCX is **not required** to apply; attaching a resume remains an optional, separate action when the employer requests it.

Use the [example résumé](resume.example.json) as a starting point. The fields `contact`, `summary`, `experience`, `skills`, `education`, `projects`, `certifications`, `languages`, `awards` and `source` are the canonical contract; empty arrays are valid for sections with no information. No legacy flat-profile keys are accepted.

The `x-atsExportGuidance` annotation describes ATS-friendly *document rendering*, not parser requirements; JSON validation cannot guarantee that a PDF or DOCX has a readable layout or appropriate formatting.
