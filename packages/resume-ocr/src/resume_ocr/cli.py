"""Command-line interface: emit one JSON result on stdout."""

import argparse
import json
import sys
from pathlib import Path

from .extract import extract_pdf


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Extract PDF text with pypdfium2 + RapidOCR"
    )
    parser.add_argument("file", type=Path)
    args = parser.parse_args(argv)
    try:
        result = extract_pdf(args.file)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ImportError, ModuleNotFoundError) as exc:
        print(
            f"Python PDF dependency missing: {exc}. Verify the selected Python "
            "environment or restart the application with npm run dev.",
            file=sys.stderr,
        )
        return 2
    except Exception as exc:
        print(f"PDF extraction failed: {exc}", file=sys.stderr)
        return 1
