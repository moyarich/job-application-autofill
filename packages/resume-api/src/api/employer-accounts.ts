import type { RouteHandler } from "../server/types.ts";
import { reply, record } from "../server/types.ts";
import { employerAccountIdentity } from "../../../job-sites/employer-account.ts";

export const handleEmployerAccounts: RouteHandler = async ({
  req,
  url,
  store,
  profileId,
}) => {
  if (req.method === "GET" && url.pathname === "/api/employer-accounts")
    return reply(200, { accounts: store.listAccounts(profileId) });
  if (
    req.method === "POST" &&
    url.pathname === "/api/employer-accounts/status"
  ) {
    const payload = record(await req.readJson());
    if (typeof payload.jobId !== "string" || typeof payload.status !== "string")
      throw new Error("A job ID and account status are required.");
    if (payload.status !== "ready" && payload.status !== "setup_required")
      throw new Error("Invalid employer account status.");
    const job = store
      .getJobList(profileId)
      .jobs.find((item) => item.id === payload.jobId);
    if (!job)
      throw new Error("Job does not belong to the selected local profile.");
    const identity = employerAccountIdentity(job.url, job.company);
    if (!identity) throw new Error("Employer account cannot be identified.");
    store.getOrCreateEmployerAccount(profileId, identity);
    return reply(
      200,
      store.setEmployerAccountStatus(
        profileId,
        identity.provider,
        identity.employerKey,
        payload.status,
      ),
    );
  }
  return undefined;
};
