import type { RouteHandler } from "../server/types.ts";
import { DEFAULT_PROFILE_ID } from "../database/store.ts";
import { reply, record } from "../server/types.ts";

export const handleProfiles: RouteHandler = async ({ req, url, store }) => {
  if (req.method === "GET" && url.pathname === "/api/profiles")
    return reply(200, {
      profiles: store.listProfiles(),
      defaultProfileId: DEFAULT_PROFILE_ID,
    });
  if (req.method === "POST" && url.pathname === "/api/profiles") {
    const payload = record(await req.readJson());
    return reply(201, store.createProfile(payload.name));
  }
  const profileRoute = url.pathname.match(
    /^\/api\/profiles\/([0-9a-f-]{36})$/i,
  );
  if (profileRoute && req.method === "PATCH") {
    const payload = record(await req.readJson());
    return reply(200, store.renameProfile(profileRoute[1], payload.name));
  }
  if (profileRoute && req.method === "DELETE") {
    store.deleteProfile(profileRoute[1]);
    return reply(200, { deleted: true });
  }
  return undefined;
};
