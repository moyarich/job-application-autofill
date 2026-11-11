"""Test native text extraction and OCR fallback."""
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from PIL import Image, ImageDraw

from resume_ocr import extract_pdf
from resume_ocr.text import readable_length


try:
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None


class TestPdfPipeline(unittest.TestCase):
    """Verify when extraction uses native text or OCR."""

    def test_readable_text_threshold(self):
        """Punctuation and whitespace do not count toward the OCR threshold."""
        self.assertEqual(readable_length("  A+B 12 !"), 4)

    @unittest.skipIf(canvas is None, "reportlab is not installed")
    def test_native_text_extraction_does_not_initialize_ocr(self):
        """Selectable text bypasses OCR initialization."""
        with tempfile.TemporaryDirectory() as folder:
            filename = Path(folder) / "text.pdf"
            c = canvas.Canvas(str(filename))
            c.drawString(
                72,
                720,
                "Ada Lovelace ada@example.com TypeScript React Python AWS"
            )
            c.save()

            def must_not_initialize():
                raise AssertionError("OCR must not initialize for text PDFs")

            result = extract_pdf(
                filename, threshold=20, ocr_factory=must_not_initialize
            )
            self.assertEqual(result["ocrPages"], [])
            self.assertIn("ada@example.com", result["text"])

    @unittest.skipIf(canvas is None, "reportlab is not installed")
    def test_scanned_page_falls_back_to_ocr(self):
        """Scanned pages return OCR text and the page number."""
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)
            image_file = source / "scan.png"
            with Image.new("RGB", (1200, 300), "white") as image:
                ImageDraw.Draw(image).text(
                    (50, 100), "Ada Lovelace resume", fill="black"
                )
                image.save(image_file)
            pdf_file = source / "scan.pdf"
            c = canvas.Canvas(str(pdf_file))
            c.drawImage(str(image_file), 30, 500, width=540, height=135)
            c.save()

            called = []

            def create_ocr():
                called.append(True)
                return lambda _image: SimpleNamespace(
                    txts=("Ada Lovelace", "ada@example.com")
                )

            result = extract_pdf(pdf_file, ocr_factory=create_ocr)
            self.assertEqual(result["ocrPages"], [1])
            self.assertEqual(result["pageCount"], 1)
            self.assertIn("ada@example.com", result["text"])
            self.assertEqual(len(called), 1)


if __name__ == "__main__":
    unittest.main()
