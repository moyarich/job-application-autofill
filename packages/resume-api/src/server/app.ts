import { routes } from "../api/index.ts";
import type { ApiRequest, ApiResponse, Store } from "../types/types.ts";

import { DEFAULT_PROFILE_ID } from "../database/store.ts";
import { reply } from "./reply.ts";

const DASHBOARD_CLIENT = "dashboard";

type Headers = ApiRequest["headers"];

/** Only the local dashboard (matching origin, when sent) may call this API. */
function isDashboardRequest(headers: Headers, allowedOrigin: string): boolean {
  const { origin } = headers;
  const originAllowed = !origin || origin === allowedOrigin;
  // Fetch Metadata prevents a different website from reading local resume data,
  // even if it attempts to supply the dashboard marker header.
  const fetchSite = headers["sec-fetch-site"];
  const sameSite = !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
  return originAllowed && sameSite && headers["x-moya-client"] === DASHBOARD_CLIENT;
}

/** Read a header that must not be repeated. */
function singleHeader(headers: Headers, name: string, label: string) {
  const value = headers[name];
  if (Array.isArray(value)) {
    throw new Error(`Multiple ${label} IDs are not allowed.`);
  }
  return value;
}

/** Transport-independent API: pass the same request shape from Node, Express, Fastify, etc. */
export function createApiHandler(store: Store, options: { origin: string }) {
  return async (req: ApiRequest): Promise<ApiResponse> => {
    try {
      const { url, method, headers } = req;

      // Public: no client check.
      if (method === "GET" && url.pathname === "/api/health") {
        return reply(200, { ok: true });
      }

      if (!isDashboardRequest(headers, options.origin)) {
        return reply(403, {
          error: "Only the local dashboard may access this API.",
        });
      }

      const profileId =
        singleHeader(headers, "x-profile-id", "profile") ?? DEFAULT_PROFILE_ID;
      const resumeIdHeader = singleHeader(headers, "x-resume-id", "resume");

      const context = { req, url, store, profileId, resumeIdHeader };
      for (const route of routes) {
        const result = await route(context);
        if (result !== undefined) return result;
      }

      return reply(404, { error: "Unknown API route." });
    } catch {
      // Validation and downstream exceptions may contain uploaded resume text,
      // names, emails or employer form values. Never echo/log raw exceptions.
      return reply(400, { error: "Request could not be processed." });
    }
  };
}
