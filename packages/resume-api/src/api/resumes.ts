import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";


export const handleResumes: RouteHandler = async ({ req, url, store, profileId, resumeIdHeader }) => {
    if (req.method === "GET" && url.pathname === "/api/resumes")
      return reply(200, { resumes: store.listResumes(profileId) });
    if (req.method === "POST" && url.pathname === "/api/resumes") {
      const payload = record(await req.readJson());
      if (payload.copyId != null && typeof payload.copyId !== "string")
        throw new Error("Invalid source resume ID.");
      return reply(201,
        store.createResume(
          profileId,
          payload.name,
          payload.copyId as string | undefined,
        ),
      );
    }
    const resumeRoute = url.pathname.match(
      /^\/api\/resumes\/([0-9a-f-]{36})$/i,
    );
    if (resumeRoute && req.method === "PATCH") {
      const payload = record(await req.readJson());
      return reply(200,
        store.renameResume(profileId, resumeRoute[1], payload.name),
      );
    }
    if (resumeRoute && req.method === "DELETE") {
      store.deleteResume(profileId, resumeRoute[1]);
      return reply(200, { deleted: true });
    }
  return undefined;
};
