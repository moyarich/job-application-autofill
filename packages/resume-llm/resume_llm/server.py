"""Serve a single, reusable local resume extractor over HTTP."""

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path

from .extract import MODEL
from .profile import ResumeExtractor

MAX_BODY_BYTES = 10 * 1024 * 1024


def serve(extractor, host, port):
    class ParseHandler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def respond(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path != "/parse":
                self.respond(404, {"error": "Unknown route."})
                return
            if self.headers.get_content_type() != "application/json":
                self.respond(415, {"error": "Expected application/json."})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length > MAX_BODY_BYTES:
                    self.respond(413, {"error": "Resume text exceeds 10 MB."})
                    return
                payload = json.loads(self.rfile.read(max(length, 0)))
                text = payload.get("text") if isinstance(payload, dict) else None
                if not isinstance(text, str) or not text.strip():
                    raise ValueError
            except (ValueError, TimeoutError):
                self.respond(400, {"error": "Expected nonempty resume text."})
                return

            try:
                profile = extractor.extract(text)
            except Exception:
                self.respond(500, {"error": "Qwen could not parse the resume."})
                return
            self.respond(200, profile)

    with HTTPServer((host, port), ParseHandler) as server:
        print(f"Resume parser listening on {host}:{port}", flush=True)
        server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4178)
    args = parser.parse_args()
    extractor = ResumeExtractor.from_schema_file(
        args.schema, checkpoint=args.model, offline=args.offline
    )
    try:
        serve(extractor, args.host, args.port)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
