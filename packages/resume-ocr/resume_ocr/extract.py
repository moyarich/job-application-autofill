"""PDFium extraction with per-page OCR fallback."""

from pathlib import Path

from .ocr import recognize_page
from .settings import MAX_FILE_BYTES, MAX_PAGES, MIN_TEXT_CHARS, OCR_DPI
from .text import readable_length, recover_vector_bullets


def extract_pdf(pdf_path, *, threshold=MIN_TEXT_CHARS, dpi=OCR_DPI, ocr_factory=None):
    import pypdfium2 as pdfium

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

                recovered = recognize_page(page, ocr, dpi)
                # Retain selectable text when OCR finds no more readable content.
                pages.append(
                    recovered
                    if readable_length(recovered) > readable_length(embedded)
                    else embedded
                )
                ocr_pages.append(page_index + 1)
            finally:
                page.close()

        combined = "\n\n".join(part for part in pages if part)
        if not combined.strip():
            raise ValueError("No readable text found after PDF extraction and OCR")
        return {"text": combined, "ocrPages": ocr_pages, "pageCount": len(pages)}
    finally:
        pdf.close()
