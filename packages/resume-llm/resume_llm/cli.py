"""Extract a schema-validated resume profile or employment header locally."""

import argparse
import json
from pathlib import Path
import sys

from .extract import MODEL, EmploymentHeaderExtractor
from .profile import ResumeExtractor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "file",
        nargs="?",
        help="PDF, UTF-8 text file, or - for full resume text on stdin. Omit for a single header.",
    )
    parser.add_argument(
        "--schema", required=True, type=Path, help="Path to the resume JSON Schema"
    )
    parser.add_argument(
        "--print-schema",
        action="store_true",
        help="Print the resume JSON Schema and exit",
    )
    parser.add_argument(
        "--model", default=MODEL, help="Checkpoint name or local directory"
    )
    parser.add_argument(
        "--offline", action="store_true", help="Use only cached model files"
    )
    args = parser.parse_args()
    options = {"checkpoint": args.model, "offline": args.offline}

    try:
        if args.print_schema:
            print(args.schema.read_text(encoding="utf-8"), end="")
            return
        if args.file is None:
            header = sys.stdin.read()
            if not header.strip():
                parser.error("Provide one employment header on standard input.")
            extractor = EmploymentHeaderExtractor.from_schema_file(
                args.schema, **options
            )
            result = extractor.extract(header)
        else:
            extractor = ResumeExtractor.from_schema_file(args.schema, **options)
            result = (
                extractor.extract(sys.stdin.read())
                if args.file == "-"
                else extractor.extract_file(args.file)
            )
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
