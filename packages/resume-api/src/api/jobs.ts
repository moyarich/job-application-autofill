import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";


export const handleJobs: RouteHandler = async ({ req, url, store, profileId, resumeIdHeader }) => {
    const jobStatus = url.pathname.match(
      /^\/api\/jobs\/([0-9a-f-]{36})\/status$/,
    );
    if (req.method === "POST" && jobStatus) {
      const { status } = record(await req.readJson());
      if (typeof status !== "string")
        throw new Error("Application status must be a string.");
      const snapshot = store.getSnapshot(profileId);
      if (!snapshot.jobs.some((job) => job.id === jobStatus[1]))
        throw new Error("Application not found.");
      snapshot.jobs = snapshot.jobs.map((job) =>
        job.id === jobStatus[1] ? { ...job, status } : job,
      );
      return reply(200,
        store.saveSnapshot(snapshot, profileId, resumeIdHeader),
      );
    }
  return undefined;
};
