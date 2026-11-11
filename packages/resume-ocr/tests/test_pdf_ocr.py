"""Regression tests: selectable text avoids OCR; scanned images use RapidOCR."""
import tempfile
import unittest
from pathlib import Path

from resume_ocr import extract_pdf
from resume_ocr.text import readable_length


class TestPdfPipeline(unittest.TestCase):
    def setUp(self):
        try:
            import pypdfium2 as pdfium
            from PIL import Image, ImageDraw
        except ImportError as exc:
            self.skipTest(f"PDF OCR dependencies are not installed: {exc}")

    def test_readable_text_threshold(self):
        self.assertEqual(readable_length("  A+B 12 !"), 4)

    def test_native_text_extraction_does_not_initialize_ocr(self):
        import pypdfium2 as pdfium
        # PDFium's raw PDF generator creates vector text from an embedded font.
        # Use a fixture created by reportlab only if the optional test dependency exists.
        try:
            from reportlab.pdfgen import canvas
        except ImportError:
            self.skipTest("reportlab is not installed")
        with tempfile.TemporaryDirectory() as folder:
            filename = Path(folder) / "text.pdf"
            c = canvas.Canvas(str(filename))
            c.drawString(72, 720, "Ada Lovelace ada@example.com TypeScript React Python AWS")
            c.save()

            def must_not_initialize():
                raise AssertionError("OCR must not initialize for text PDFs")

            result = extract_pdf(filename, threshold=20, ocr_factory=must_not_initialize)
            self.assertEqual(result["ocrPages"], [])
            self.assertIn("ada@example.com", result["text"])

    def test_scanned_page_falls_back_to_ocr(self):
        import pypdfium2 as pdfium
        from PIL import Image, ImageDraw
        try:
            from reportlab.pdfgen import canvas
        except ImportError:
            self.skipTest("reportlab is not installed")
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)
            image = Image.new("RGB", (1200, 300), "white")
            draw = ImageDraw.Draw(image)
            draw.text((50, 100), "Ada Lovelace resume", fill="black")
            image_file = source / "scan.png"
            image.save(image_file)
            pdf_file = source / "scan.pdf"
            c = canvas.Canvas(str(pdf_file))
            c.drawImage(str(image_file), 30, 500, width=540, height=135)
            c.save()

            class StubResult:
                txts = ("Ada Lovelace", "ada@example.com")

            called = []
            def create_ocr():
                called.append(True)
                return lambda image: StubResult()

            result = extract_pdf(pdf_file, ocr_factory=create_ocr)
            self.assertEqual(result["ocrPages"], [1])
            self.assertEqual(result["pageCount"], 1)
            self.assertIn("ada@example.com", result["text"])
            self.assertEqual(len(called), 1)


if __name__ == "__main__":
    unittest.main()
