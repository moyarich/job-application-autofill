import type { RouteHandler } from "../types/types.ts";
import { reply } from "../server/reply.ts";
import { record } from "./record.ts";

export const handleApplicationPreferences: RouteHandler = async ({
  req,
  url,
  store,
  profileId,
}) => {
  const path = "/api/application-preferences";
  if (url.pathname === path && req.method === "GET")
    return reply(200, {
      preferences: store.listApplicationPreferences(profileId),
      schemas: store.listApplicationPreferenceSchemas(),
    });
  if (url.pathname === path && req.method === "POST")
    return reply(
      201,
      store.saveApplicationPreference(profileId, null, await req.readJson()),
    );
  const item = url.pathname.match(
    /^\/api\/application-preferences\/([0-9a-f-]{36})$/i,
  );
  if (item && req.method === "PUT")
    return reply(
      200,
      store.saveApplicationPreference(profileId, item[1], await req.readJson()),
    );
  if (item && req.method === "DELETE") {
    const body = record(await req.readJson());
    if (!Number.isInteger(body.revision))
      throw new Error("Expected a preference revision.");
    store.deleteApplicationPreference(
      profileId,
      item[1],
      body.revision as number,
    );
    return reply(200, { deleted: true });
  }
  const selection = url.pathname.match(
    /^\/api\/applications\/([0-9a-f-]{36})\/preference$/i,
  );
  if (selection && req.method === "GET")
    return reply(200, store.getApplicationPreference(profileId, selection[1]));
  if (selection && req.method === "PUT") {
    const body = record(await req.readJson());
    if (body.preferenceId !== null && typeof body.preferenceId !== "string")
      throw new Error("Choose a saved preference or the default.");
    return reply(
      200,
      store.selectApplicationPreference(
        profileId,
        selection[1],
        body.preferenceId,
      ),
    );
  }
  return undefined;
};
