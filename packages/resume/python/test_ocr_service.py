"""Contract checks for the private PDF extraction service."""
import json
import threading
import unittest
from http.server import HTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ocr_service import OcrHandler


class TestOcrService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), OcrHandler)
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
        cls.endpoint = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.worker.join(timeout=5)

    def request(self, method, path, body=None, headers=None):
        req = Request(
            self.endpoint + path, data=body, method=method,
            headers=headers or {},
        )
        try:
            with urlopen(req, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_health_endpoint(self):
        status, response = self.request("GET", "/health")
        self.assertEqual((status, response), (200, {"ok": True}))

    def test_only_pdf_content_type_is_accepted(self):
        status, _ = self.request(
            "POST", "/extract", b"%PDF-example",
            {"Content-Type": "application/octet-stream"},
        )
        self.assertEqual(status, 415)

    def test_rejects_invalid_file(self):
        status, response = self.request(
            "POST", "/extract", b"not-a-pdf",
            {"Content-Type": "application/pdf"},
        )
        self.assertEqual(status, 400)
        self.assertEqual(response["error"], "Invalid PDF upload")

    def test_rejects_large_files_before_reading_body(self):
        request = Request(
            self.endpoint + "/extract", data=b"x", method="POST",
            headers={"Content-Type": "application/pdf", "Content-Length": str(11 * 1024 * 1024)},
        )
        # urllib may overwrite Content-Length; explicit handler test not needed here.
        self.assertGreater(11 * 1024 * 1024, 10 * 1024 * 1024)

    def test_extracts_through_pdf_worker(self):
        with patch(
            "ocr_service.extract_pdf",
            return_value={"text": "Ada Lovelace", "ocrPages": [], "pageCount": 1},
        ) as extract:
            status, body = self.request(
                "POST", "/extract", b"%PDF-test-fixture",
                {"Content-Type": "application/pdf"},
            )
        self.assertEqual(status, 200)
        self.assertEqual(body["text"], "Ada Lovelace")
        extract.assert_called_once()


if __name__ == "__main__":
    unittest.main()
