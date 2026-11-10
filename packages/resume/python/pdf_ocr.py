#!/usr/bin/env python3
"""Extract resume text locally with PDFium, falling back to RapidOCR per scanned page.

stdout is a single JSON result. Diagnostics go to stderr.
"""
import argparse
import json
import sys
from pathlib import Path

MIN_TEXT_CHARS = 40
OCR_DPI = 250
MAX_PAGES = 30
MAX_FILE_BYTES = 10 * 1024 * 1024


def readable_length(text):
    return sum(character.isalnum() for character in text)


def recover_vector_bullets(page, text_page):
    """Recover small drawn list markers which PDF text extraction cannot see."""
    from pypdfium2 import raw

    text = text_page.get_text_range()
    markers = []
    for obj in page.get_objects():
        if obj.type != raw.FPDF_PAGEOBJ_PATH:
            continue
        left, bottom, right, top = obj.get_bounds()
        width, height = right - left, top - bottom
        if 1 <= width <= 6 and 1 <= height <= 6 and 0.7 <= width / height <= 1.3:
            markers.append((right, (bottom + top) / 2))
    if not markers:
        return text

    characters = []
    for index in range(text_page.count_chars()):
        code = raw.FPDFText_GetUnicode(text_page, index)
        if not code or chr(code).isspace():
            continue
        left, bottom, right, top = text_page.get_charbox(index)
        characters.append((index, left, bottom, top))
    insertions = set()
    for marker_right, center in markers:
        candidates = [(index, left) for index, left, bottom, top in characters
                      if 0 < left - marker_right < 18 and bottom - 2 <= center <= top + 2]
        if not candidates:
            continue
        index, _ = min(candidates, key=lambda item: item[1])
        prefix = text_page.get_text_range(0, index) if index else ""
        if not prefix.rsplit("\n", 1)[-1].strip():
            insertions.add(len(prefix))
    for offset in sorted(insertions, reverse=True):
        text = text[:offset] + "• " + text[offset:]
    return text


def extract_pdf(pdf_path, *, threshold=MIN_TEXT_CHARS, dpi=OCR_DPI, ocr_factory=None):
    import pypdfium2 as pdfium

    source = Path(pdf_path)
    if not source.is_file() or source.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("PDF file is missing or exceeds 10 MB")

    pdf = pdfium.PdfDocument(str(source))
    if len(pdf) > MAX_PAGES:
        raise ValueError(f"PDF has more than {MAX_PAGES} pages")
    if len(pdf) == 0:
        raise ValueError("PDF has no pages")

    ocr = None
    pages = []
    ocr_pages = []
    try:
        for page_index in range(len(pdf)):
            page = pdf[page_index]
            try:
                text_page = page.get_textpage()
                try:
                    embedded = recover_vector_bullets(page, text_page).strip()
                finally:
                    text_page.close()

                if readable_length(embedded) >= threshold:
                    pages.append(embedded)
                    continue

                if ocr is None:
                    if ocr_factory is not None:
                        ocr = ocr_factory()
                    else:
                        from rapidocr import RapidOCR
                        ocr = RapidOCR()

                bitmap = page.render(scale=dpi / 72)
                try:
                    image = bitmap.to_pil()
                    try:
                        result = ocr(image)
                        recognized = [str(line).strip() for line in (result.txts or []) if str(line).strip()]
                        recovered = "\n".join(recognized)
                    finally:
                        image.close()
                finally:
                    bitmap.close()

                # Keep the selectable text, too, if OCR provided no additional result.
                pages.append(recovered if readable_length(recovered) > readable_length(embedded) else embedded)
                ocr_pages.append(page_index + 1)
            finally:
                page.close()
    finally:
        pdf.close()

    combined = "\n\n".join(part for part in pages if part)
    if not combined.strip():
        raise ValueError("No readable text found after PDF extraction and OCR")
    return {"text": combined, "ocrPages": ocr_pages, "pageCount": len(pages)}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Extract PDF text with pypdfium2 + RapidOCR")
    parser.add_argument("file", type=Path)
    args = parser.parse_args(argv)
    try:
        result = extract_pdf(args.file)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ImportError, ModuleNotFoundError) as exc:
        print(f"Python PDF dependency missing: {exc}. Verify the selected Python environment or restart the application with npm run dev.", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"PDF extraction failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
