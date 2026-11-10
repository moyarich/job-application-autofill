import { routes } from "../api/index.ts";
import type { ApiRequest, ApiResponse, Store } from "./types.ts";
import { reply } from "./types.ts";
import { DEFAULT_PROFILE_ID } from "../database/store.ts";

/** Transport-independent API: pass the same request shape from Node, Express, Fastify, etc. */
export function createApiHandler(store: Store, options: { origin: string }) {
  return async (req: ApiRequest): Promise<ApiResponse> => {
    try {
      const url = req.url;
      if (req.method === "GET" && url.pathname === "/api/health")
        return reply(200, { ok: true });
      if (
        (req.headers.origin && req.headers.origin !== options.origin) ||
        req.headers["x-moya-client"] !== "dashboard"
      )
        return reply(403, {
          error: "Only the local dashboard may access this API.",
        });
      if (req.method === "GET" && url.pathname === "/api/viewer/config") {
        if (!process.env.WEB_VNC_PASSWORD)
          throw new Error("WEB_VNC_PASSWORD is not configured.");
        return reply(200, { password: process.env.WEB_VNC_PASSWORD });
      }
      const profileIdHeader = req.headers["x-profile-id"];
      if (Array.isArray(profileIdHeader))
        throw new Error("Multiple profile IDs are not allowed.");
      const profileId = profileIdHeader ?? DEFAULT_PROFILE_ID;
      const resumeIdHeader = req.headers["x-resume-id"];
      if (Array.isArray(resumeIdHeader))
        throw new Error("Multiple resume IDs are not allowed.");
      const context = { req, url, store, profileId, resumeIdHeader };
      for (const route of routes) {
        const result = await route(context);
        if (result !== undefined) return result;
      }
      return reply(404, { error: "Unknown API route." });
    } catch (error) {
      console.error(error);
      return reply(400, {
        error: error instanceof Error ? error.message : "Request failed",
      });
    }
  };
}
