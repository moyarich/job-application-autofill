import type { RouteHandler } from "../types/types.ts";
import { reply } from "../server/reply.ts";

export const handleConnections: RouteHandler = async ({
  req,
  url,
  store,
  profileId,
}) => {
  if (url.pathname === "/api/connectors/mcp-oauth" && req.method === "GET") return reply(200, store.listMcpOAuthEndpoints());
  if (url.pathname === "/api/connectors/mcp-oauth" && req.method === "POST") {
    const value = await req.readJson() as { endpoint?: unknown } | null;
    return reply(200, await store.beginMcpOAuth(profileId, value?.endpoint));
  }
  if (url.pathname === "/api/connectors/mcp-discover" && req.method === "POST") {
    return reply(200, await store.discoverMcpTools(profileId, await req.readJson()));
  }
  if (url.pathname === "/api/connectors/mcp-endpoints" && req.method === "GET") {
    return reply(200, store.listMcpEndpoints());
  }
  if (url.pathname === "/api/connectors" && req.method === "GET") {
    return reply(200, store.listConnectors());
  }
  if (url.pathname === "/api/connections") {
    if (req.method === "GET") {
      return reply(200, store.listConnections(profileId));
    }
    if (req.method === "POST") {
      return reply(201, store.addConnection(profileId, await req.readJson()));
    }
  }
  const mcpLinks = url.pathname.match(/^\/api\/connections\/([0-9a-f-]{36})\/mcp-links$/i);
  if (mcpLinks && req.method === "GET") return reply(200, { links: store.listMcpLinks(profileId, mcpLinks[1]), uncertainExports: store.listMcpUncertainExports(profileId, mcpLinks[1]) });
  const importWorkflow = url.pathname.match(/^\/api\/connections\/([0-9a-f-]{36})\/import-workflow(?:\/(preview|execute))?$/i);
  if (importWorkflow) {
    const [, id, action] = importWorkflow;
    if (!action && req.method === "GET") return reply(200, store.getMcpImport(profileId, id));
    if (!action && req.method === "PUT") return reply(200, await store.saveMcpImport(profileId, id, await req.readJson()));
    if (action === "preview" && req.method === "POST") return reply(200, await store.previewMcpImport(profileId, id));
    if (action === "execute" && req.method === "POST") return reply(200, store.executeMcpImport(profileId, id, await req.readJson()));
  }
  const workflow = url.pathname.match(/^\/api\/connections\/([0-9a-f-]{36})\/workflow(?:\/(preview|execute))?$/i);
  if (workflow) {
    const [, id, action] = workflow;
    if (!action && req.method === "GET") return reply(200, store.getMcpWorkflow(profileId, id));
    if (!action && req.method === "PUT") return reply(200, await store.saveMcpWorkflow(profileId, id, await req.readJson()));
    if (action === "preview" && req.method === "POST") {
      const body = await req.readJson() as { jobId?: unknown } | null;
      return reply(200, await store.previewMcpWorkflow(profileId, id, body?.jobId));
    }
    if (action === "execute" && req.method === "POST") return reply(200, await store.executeMcpWorkflow(profileId, id, await req.readJson()));
  }
  const sync = url.pathname.match(
    /^\/api\/connections\/([0-9a-f-]{36})\/(mapping|import|export|history|links|changes|resolve|sync|schedule)$/i,
  );
  if (sync) {
    const [, id, action] = sync;
    if (action === "schedule" && req.method === "GET")
      return reply(200, store.getConnectionSchedule(profileId, id));
    if (action === "schedule" && req.method === "PUT")
      return reply(200, store.saveConnectionSchedule(profileId, id, await req.readJson()));
    if (action === "sync" && req.method === "POST")
      return reply(200, await store.syncConnectionApplications(profileId, id));
    if (action === "resolve" && req.method === "POST")
      return reply(200, await store.resolveConnectionChange(profileId, id, await req.readJson()));
    if (action === "changes" && req.method === "GET")
      return reply(200, await store.reviewConnectionChanges(profileId, id));
    if (action === "history" && req.method === "GET")
      return reply(200, store.listConnectionHistory(profileId, id));
    if (action === "links" && req.method === "GET")
      return reply(200, store.listConnectionRecordLinks(profileId, id));
    if (action === "mapping" && req.method === "GET")
      return reply(200, store.getConnectionMapping(profileId, id));
    if (action === "mapping" && req.method === "PUT")
      return reply(200, await store.saveConnectionMapping(profileId, id, await req.readJson()));
    if (action === "import" && req.method === "POST")
      return reply(200, await store.importConnectionApplications(profileId, id));
    if (action === "export" && req.method === "POST")
      return reply(200, await store.exportConnectionApplication(profileId, id, await req.readJson()));
  }
  const match = url.pathname.match(
    /^\/api\/connections\/([0-9a-f-]{36})(?:\/(tools)(?:\/([a-zA-Z0-9_.-]+))?)?$/i,
  );
  if (!match) return undefined;
  const [, id, tools, name] = match;
  if (!tools && req.method === "DELETE") {
    return reply(200, store.removeConnection(profileId, id));
  }
  if (tools && !name && req.method === "GET") {
    return reply(200, await store.listConnectionTools(profileId, id));
  }
  if (tools && name && req.method === "POST") {
    return reply(
      200,
      await store.callConnectionTool(profileId, id, name, await req.readJson()),
    );
  }
  return undefined;
};
