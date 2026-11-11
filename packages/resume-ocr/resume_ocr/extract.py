"""PDFium extraction with per-page OCR fallback."""

from pathlib import Path

import pypdfium2 as pdfium

from .ocr import ocr_page
from .settings import MAX_FILE_BYTES, MAX_PAGES, MIN_TEXT_CHARS, OCR_DPI
from .text import readable_length, recover_vector_bullets


def _create_ocr():
    # Native-text PDFs should not load the OCR runtime.
    from rapidocr import RapidOCR  # pylint: disable=import-outside-toplevel

    return RapidOCR()


def _embedded_text(page):
    text_page = page.get_textpage()
    try:
        return recover_vector_bullets(page, text_page).strip()
    finally:
        text_page.close()


def extract_pdf(pdf_path, *, threshold=MIN_TEXT_CHARS,
                dpi=OCR_DPI, ocr_factory=None):
    """Use OCR only when a page has too little selectable text."""
    source = Path(pdf_path)
    if not source.is_file() or source.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("PDF file is missing or exceeds 10 MB")

    pdf = pdfium.PdfDocument(str(source))
    try:
        if len(pdf) > MAX_PAGES:
            raise ValueError(f"PDF has more than {MAX_PAGES} pages")
        if len(pdf) == 0:
            raise ValueError("PDF has no pages")

        ocr = None
        pages = []
        ocr_pages = []
        for page_number, page in enumerate(pdf, start=1):
            try:
                embedded = _embedded_text(page)
                if readable_length(embedded) >= threshold:
                    pages.append(embedded)
                    continue

                if ocr is None:
                    ocr = (ocr_factory or _create_ocr)()

                recovered = ocr_page(page, ocr, dpi)
                # Keep selectable text if OCR finds no more readable text.
                pages.append(
                    recovered
                    if readable_length(recovered) > readable_length(embedded)
                    else embedded
                )
                ocr_pages.append(page_number)
            finally:
                page.close()

        combined = "\n\n".join(part for part in pages if part)
        if not combined.strip():
            raise ValueError(
                "No readable text found after PDF extraction and OCR")
        return {
            "text": combined,
            "ocrPages": ocr_pages,
            "pageCount": len(pages),
        }
    finally:
        pdf.close()
