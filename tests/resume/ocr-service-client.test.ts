import { afterEach, expect, it, vi } from "vitest";
import { extractResumeText } from "../../packages/resume/src/extract-resume/index.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("routes PDF extraction to the private OCR service without starting local Python", async () => {
  vi.stubEnv("OCR_SERVICE_URL", "http://ocr:8765");
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ text: "Ada Lovelace", ocrPages: [], pageCount: 1 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const input = Buffer.from("%PDF-1.4 test");
  await expect(extractResumeText(input, "pdf")).resolves.toBe("Ada Lovelace");
  expect(fetchMock).toHaveBeenCalledOnce();
  const [endpoint, options] = fetchMock.mock.calls[0] as unknown as [
    URL,
    { method: string; body: Uint8Array; headers: Record<string, string> },
  ];
  expect(endpoint.href).toBe("http://ocr:8765/extract");
  expect(options.method).toBe("POST");
  expect(options.headers["Content-Type"]).toBe("application/pdf");
  expect(Buffer.from(options.body)).toEqual(input);
});
