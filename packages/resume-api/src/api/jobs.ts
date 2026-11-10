import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";
import { lookupJobMetadata } from "../services/job-metadata.ts";

export const handleJobs: RouteHandler = async ({ req, url, store, profileId }) => {
  if (req.method === "POST" && url.pathname === "/api/jobs/metadata") {
    const { jobUrl } = record(await req.readJson());
    return reply(200, await lookupJobMetadata(jobUrl));
  }
  if (req.method === "GET" && url.pathname === "/api/jobs")
    return reply(200, store.getJobList(profileId));

  if (req.method === "PUT" && url.pathname === "/api/jobs") {
    try {
      return reply(200, store.updateJobRecord(await req.readJson(), profileId));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "STALE_STATE")
        return reply(409, { error: error.message });
      throw error;
    }
  }

  const jobRoute = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})$/i);
  if (req.method === "DELETE" && jobRoute) {
    try {
      return reply(200, store.deleteJobRecord(jobRoute[1], await req.readJson(), profileId));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "STALE_STATE")
        return reply(409, { error: error.message });
      throw error;
    }
  }

  const statusRoute = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})\/status$/i);
  if (req.method === "POST" && statusRoute) {
    const { status } = record(await req.readJson());
    if (typeof status !== "string")
      throw new Error("Application status must be a string.");
    return reply(200, store.setJobStatus(profileId, statusRoute[1], status));
  }
  return undefined;
};
