#!/usr/bin/env python3
"""Private, single-worker PDF extraction endpoint for the Docker OCR service.

The OCR container is only reachable on the internal Compose network. It accepts
raw PDF bytes, never persists uploads, and returns structured extraction data.
"""
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from pdf_ocr import MAX_FILE_BYTES, extract_pdf


class OcrHandler(BaseHTTPRequestHandler):
    server_version = "MoyaOCR/1"

    def send_json(self, code, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"ok": True})
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/extract":
            return self.send_json(404, {"error": "Not found"})
        size_header = self.headers.get("Content-Length", "")
        try:
            size = int(size_header)
        except ValueError:
            return self.send_json(411, {"error": "Content-Length required"})
        if size < 5 or size > MAX_FILE_BYTES:
            return self.send_json(413, {"error": "PDF must be between 5 bytes and 10 MB"})
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/pdf":
            return self.send_json(415, {"error": "Expected application/pdf"})
        data = self.rfile.read(size)
        if len(data) != size or not data.startswith(b"%PDF-"):
            return self.send_json(400, {"error": "Invalid PDF upload"})
        filename = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp:
                filename = Path(temp.name)
                temp.write(data)
            return self.send_json(200, extract_pdf(filename))
        except ValueError as exc:
            return self.send_json(422, {"error": str(exc)})
        except Exception:
            self.log_error("PDF extraction failed")
            return self.send_json(500, {"error": "PDF extraction failed"})
        finally:
            if filename is not None:
                filename.unlink(missing_ok=True)

    def log_request(self, code="-", size="-"):
        # Docker polls /health every ten seconds. Keep successful probes quiet
        # while preserving error responses and actual extraction request logs.
        if self.command == "GET" and self.path == "/health" and code == 200:
            return
        super().log_request(code, size)


if __name__ == "__main__":
    port = int(os.environ.get("OCR_PORT", "8765"))
    HTTPServer(("0.0.0.0", port), OcrHandler).serve_forever()
