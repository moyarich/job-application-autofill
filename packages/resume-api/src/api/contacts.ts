import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";


export const handleContacts: RouteHandler = async ({ req, url, store, profileId, resumeIdHeader }) => {
    if (req.method === "GET" && url.pathname === "/api/profile-contacts")
      return reply(200, { contacts: store.listContacts(profileId) });
    if (req.method === "POST" && url.pathname === "/api/profile-contacts") {
      const payload = record(await req.readJson());
      return reply(201,
        store.createContact(profileId, payload.contact, payload.name),
      );
    }
    if (
      req.method === "POST" &&
      url.pathname === "/api/profile-contacts/import"
    ) {
      const payload = record(await req.readJson());
      if (typeof payload.resumeId !== "string")
        throw new Error("Resume ID required.");
      return reply(200,
        store.resolveImportContact(
          profileId,
          payload.resumeId,
          payload.contact,
          payload.choices,
        ),
      );
    }
    const contactRoute = url.pathname.match(
      /^\/api\/profile-contacts\/([0-9a-f-]{36})$/i,
    );
    if (contactRoute && req.method === "PATCH") {
      const payload = record(await req.readJson());
      return reply(200,
        store.updateContactRecord(
          profileId,
          contactRoute[1],
          payload.contact,
          payload.name,
        ),
      );
    }
    if (contactRoute && req.method === "DELETE")
      return reply(200,
        store.deleteContactRecord(profileId, contactRoute[1]),
      );
    const defaultContactRoute = url.pathname.match(
      /^\/api\/profile-contacts\/([0-9a-f-]{36})\/default$/i,
    );
    if (defaultContactRoute && req.method === "POST")
      return reply(200,
        store.setDefaultContact(profileId, defaultContactRoute[1]),
      );
  return undefined;
};
