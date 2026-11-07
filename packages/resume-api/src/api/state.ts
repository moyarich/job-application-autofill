import type { RouteHandler } from "../server/types.ts";
import { reply } from "../server/types.ts";


export const handleState: RouteHandler = async ({ req, url, store, profileId, resumeIdHeader }) => {
    if (req.method === "GET" && url.pathname === "/api/state")
      return reply(200, store.getSnapshot(profileId, resumeIdHeader));
    if (req.method === "PUT" && url.pathname === "/api/state") {
      const payload = await req.readJson();
      try {
        return reply(200,
          store.saveSnapshot(payload, profileId, resumeIdHeader),
        );
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "STALE_STATE"
        )
          return reply(409, { error: error.message });
        throw error;
      }
    }
  return undefined;
};
