import type { RouteHandler } from "../types/types.ts";
import { reply } from "../server/reply.ts";
import { record } from "./record.ts";

export const handleResumes: RouteHandler = async ({
  req,
  url,
  store,
  profileId,
}) => {
  if (req.method === "POST" && url.pathname === "/api/resumes/import") {
    try {
      return reply(
        200,
        store.importResumeDocument(profileId, await req.readJson()),
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
  if (req.method === "GET" && url.pathname === "/api/resumes")
    return reply(200, { resumes: store.listResumes(profileId) });
  if (req.method === "POST" && url.pathname === "/api/resumes") {
    const payload = record(await req.readJson());
    if (payload.copyId != null && typeof payload.copyId !== "string")
      throw new Error("Invalid source resume ID.");
    return reply(
      201,
      store.createResume(
        profileId,
        payload.name,
        payload.copyId as string | undefined,
      ),
    );
  }
  const contentRoute = url.pathname.match(
    /^\/api\/resumes\/([0-9a-f-]{36})\/content$/i,
  );
  if (contentRoute && req.method === "GET") {
    return reply(200, store.getResumeContent(profileId, contentRoute[1]));
  }
  if (contentRoute && req.method === "PUT") {
    try {
      return reply(
        200,
        store.saveResumeContent(
          await req.readJson(),
          profileId,
          contentRoute[1],
        ),
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
  const resumeRoute = url.pathname.match(/^\/api\/resumes\/([0-9a-f-]{36})$/i);
  if (resumeRoute && req.method === "PATCH") {
    const payload = record(await req.readJson());
    return reply(
      200,
      store.renameResume(profileId, resumeRoute[1], payload.name),
    );
  }
  if (resumeRoute && req.method === "DELETE") {
    store.deleteResume(profileId, resumeRoute[1]);
    return reply(200, { deleted: true });
  }
  return undefined;
};
