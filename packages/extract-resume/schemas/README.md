# Resume JSON schema

The canonical structured resume schema is [`schemas/resume.schema.json`](schemas/resume.schema.json), using JSON Schema Draft 2020-12.

The canonical structure is `contact`, `summary`, `experience`, `skills` (a string array), `education`, `projects`, `certifications`, `languages`, `awards`, and `source`. All sections are present in parser output, with empty arrays for sections not yet extracted.

```js
import { extractProfile } from "@moyarich/extract-resume";
const parsed = extractProfile(resumeText);
console.log(JSON.stringify(parsed, null, 2));
```

This is a new nested schema; no flat-profile compatibility or migration is provided. Dates use `YYYY` or `YYYY-MM`; empty dates mean unknown and `endDate: null` means no end date (usually a current role). `isCurrent` is an explicit boolean, and employers and job titles are never inferred when missing.

See [`schemas/resume.example.json`](schemas/resume.example.json) for a complete example with the optional sections.

The parser is heuristic and not a source of verified employment history; review before submitting. Formatting guidance under `x-atsExportGuidance` is advisory for document rendering, not enforced by JSON Schema.
