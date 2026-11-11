import { describe, expect, it, vi } from "vitest";
import { openStore } from "../../packages/resume-api/src/database/store.ts";
import { createApiHandler } from "../../packages/resume-api/src/server/app.ts";
import { ApiRequest } from "../../packages/resume-api/src/types/types.ts";

function request(path: string, method = "GET", body?: unknown): ApiRequest {
  return {
    method,
    url: new URL(path, "http://localhost"),
    headers: { "x-moya-client": "dashboard" },
    readJson: async () => body,
  };
}

describe("transport-neutral resume API", () => {
  it("serves the same profiles endpoint without a node:http request", async () => {
    const store = openStore(":memory:");
    try {
      const handler = createApiHandler(store, {
        origin: "http://localhost:5173",
      });
      expect(await handler(request("/api/health"))).toEqual({
        status: 200,
        body: { ok: true },
        contentType: undefined,
      });
      const created = await handler(
        request("/api/profiles", "POST", { name: "Example" }),
      );
      expect(created.status).toBe(201);
      const profiles = await handler(request("/api/profiles"));
      expect(profiles.status).toBe(200);
      expect(
        (profiles.body as { profiles: { name: string }[] }).profiles.some(
          (p) => p.name === "Example",
        ),
      ).toBe(true);
    } finally {
      store.close();
    }
  });

  it("rejects requests from untrusted clients independent of the server framework", async () => {
    const store = openStore(":memory:");
    try {
      const handler = createApiHandler(store, {
        origin: "http://localhost:5173",
      });
      const req = request("/api/profiles");
      req.headers["x-moya-client"] = "unknown";
      expect((await handler(req)).status).toBe(403);
      const untrustedOrigin = request("/api/profiles");
      untrustedOrigin.headers.origin = "https://other.example";
      expect((await handler(untrustedOrigin)).status).toBe(403);
      const crossSite = request("/api/profiles");
      crossSite.headers["sec-fetch-site"] = "cross-site";
      expect((await handler(crossSite)).status).toBe(403);
    } finally {
      store.close();
    }
  });
  it("never exposes environment VNC credentials in an API response", async () => {
    const store = openStore(":memory:");
    const original = process.env.WEB_VNC_PASSWORD;
    process.env.WEB_VNC_PASSWORD = "private-vnc-secret";
    try {
      const handler = createApiHandler(store, { origin: "http://localhost:5173" });
      const response = await handler(request("/api/viewer/config"));
      expect(response.status).toBe(404);
      expect(JSON.stringify(response.body)).not.toContain("private-vnc-secret");
    } finally {
      if (original === undefined) delete process.env.WEB_VNC_PASSWORD;
      else process.env.WEB_VNC_PASSWORD = original;
      store.close();
    }
  });

  it("never sends resume PII from unexpected errors to the browser or server logs", async () => {
    const store = openStore(":memory:");
    const pii = "private-person@example.test / 555-0101";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const handler = createApiHandler(store, { origin: "http://localhost:5173" });
      vi.spyOn(store, "listResumes").mockImplementation(() => {
        throw new Error(pii);
      });
      const response = await handler(request("/api/resumes"));
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).not.toContain(pii);
      expect(response.body).toEqual({ error: "Request could not be processed." });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      store.close();
    }
  });
});
