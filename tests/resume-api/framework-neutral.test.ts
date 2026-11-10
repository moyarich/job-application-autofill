import { describe, expect, it } from "vitest";
import { openStore } from "../../packages/resume-api/src/database/store.ts";
import { createApiHandler } from "../../packages/resume-api/src/server/app.ts";
import type { ApiRequest } from "../../packages/resume-api/src/server/types.ts";

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
    } finally {
      store.close();
    }
  });
});
