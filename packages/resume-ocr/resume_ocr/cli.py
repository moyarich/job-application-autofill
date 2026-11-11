"""Command-line interface: emit one JSON result on stdout."""

import argparse
import json
import sys
from pathlib import Path

from .extract import extract_pdf


def main(argv=None):
    """Parse arguments and return a process exit status."""
    parser = argparse.ArgumentParser(
        description="Extract PDF text with pypdfium2 + RapidOCR"
    )
    parser.add_argument("file", type=Path)
    args = parser.parse_args(argv)
    try:
        result = extract_pdf(args.file)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except ImportError as exc:
        print(
            f"Python PDF dependency missing: {exc}. Verify the selected "
            "Python environment or restart the application with npm run dev.",
            file=sys.stderr,
        )
        return 2
    # Send third-party extraction errors to stderr to keep stdout valid JSON.
    except Exception as exc:  # pylint: disable=broad-exception-caught
        print(f"PDF extraction failed: {exc}", file=sys.stderr)
        return 1
