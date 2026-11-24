import { createHash, randomBytes } from "node:crypto";

type Config = {
  endpoint: string;
  issuer: string;
  resourceMetadata: string;
  authorizationMetadata: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scopes: string[];
};
export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};
export type OAuthGrant = { config: Config; tokens: OAuthTokens };

function https(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Invalid OAuth URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search)
    throw new Error("OAuth requires approved HTTPS URLs.");
  return url.href;
}

function configurations(): Config[] {
  const raw: unknown = JSON.parse(process.env.MOYA_MCP_OAUTH_CONFIG ?? "[]");
  if (!Array.isArray(raw) || raw.length > 30) throw new Error("Invalid OAuth configuration.");
  return raw.map((item) => {
    if (!item || typeof item !== "object" || !Array.isArray(item.scopes) ||
      item.scopes.some((scope: unknown) => typeof scope !== "string" || !/^[!-~]+$/.test(scope) || /["\\]/.test(scope)))
      throw new Error("Invalid OAuth scopes.");
    return {
      endpoint: https(item.endpoint), issuer: https(item.issuer),
      resourceMetadata: https(item.resourceMetadata), authorizationMetadata: https(item.authorizationMetadata),
      authorizationEndpoint: https(item.authorizationEndpoint), tokenEndpoint: https(item.tokenEndpoint),
      clientId: https(item.clientId), scopes: item.scopes as string[],
    };
  });
}
function configuration(endpoint: string): Config {
  const config = configurations().find((item) => item.endpoint === endpoint);
  if (!config) throw new Error("OAuth is not configured for this endpoint.");
  return config;
}
function redirectUri(): string {
  const origin = new URL(process.env.AUTOFILL_ORIGIN || "http://localhost:5173");
  if (origin.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
    origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("OAuth requires a local dashboard origin.");
  return new URL("/api/connectors/mcp-oauth/callback", origin).href;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid OAuth response.");
  return value as Record<string, unknown>;
}
async function json(url: string, request: typeof fetch, body?: URLSearchParams) {
  const response = await request(url, {
    method: body ? "POST" : "GET",
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body, redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("application/json")) {
    await response.body?.cancel();
    throw new Error("OAuth request failed.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "", size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) throw new Error("OAuth response too large.");
      text += decoder.decode(value, { stream: true });
    }
    return object(JSON.parse(text + decoder.decode()));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
function includes(value: unknown, item: string) {
  return Array.isArray(value) && value.includes(item);
}
function parseTokens(raw: Record<string, unknown>, previous?: OAuthTokens): OAuthTokens {
  const token = raw.access_token;
  const refresh = raw.refresh_token;
  if (typeof token !== "string" || !token || token.length > 16384 || /\s/.test(token) ||
    typeof raw.token_type !== "string" || raw.token_type.toLowerCase() !== "bearer" ||
    typeof raw.expires_in !== "number" || !Number.isFinite(raw.expires_in) || raw.expires_in <= 0 ||
    (refresh !== undefined && (typeof refresh !== "string" || !refresh || refresh.length > 16384 || /\s/.test(refresh))))
    throw new Error("Invalid OAuth token response.");
  return { accessToken: token, refreshToken: refresh as string | undefined ?? previous?.refreshToken,
    expiresAt: Date.now() + Math.min(raw.expires_in, 86400 * 365) * 1000 };
}

export function createMcpOAuth(request: typeof fetch = fetch) {
  type Pending = { owner: string; config: Config; verifier: string; expires: number; redirect: string };
  const pending = new Map<string, Pending>();
  const grants = new Map<string, { owner: string; grant: OAuthGrant; expires: number }>();
  function prune() {
    const now = Date.now();
    for (const [id, item] of pending) if (item.expires <= now) pending.delete(id);
    for (const [id, item] of grants) if (item.expires <= now) grants.delete(id);
  }
  function endpoints() { return configurations().map((item) => item.endpoint); }
  async function begin(owner: string, endpoint: string) {
    prune();
    if (pending.size >= 50) throw new Error("Too many pending authorizations.");
    const config = configuration(endpoint);
    const resource = await json(config.resourceMetadata, request);
    if (resource.resource !== config.endpoint || !includes(resource.authorization_servers, config.issuer))
      throw new Error("OAuth resource metadata does not match approved configuration.");
    const metadata = await json(config.authorizationMetadata, request);
    if (metadata.issuer !== config.issuer ||
      metadata.authorization_endpoint !== config.authorizationEndpoint ||
      metadata.token_endpoint !== config.tokenEndpoint ||
      metadata.client_id_metadata_document_supported !== true ||
      metadata.authorization_response_iss_parameter_supported !== true ||
      !includes(metadata.code_challenge_methods_supported, "S256") ||
      !includes(metadata.response_types_supported, "code") ||
      !includes(metadata.token_endpoint_auth_methods_supported, "none"))
      throw new Error("Authorization server does not support the required OAuth flow.");
    const redirect = redirectUri();
    const client = await json(config.clientId, request);
    if (client.client_id !== config.clientId || !includes(client.redirect_uris, redirect) ||
      client.token_endpoint_auth_method !== "none" || !includes(client.grant_types, "authorization_code"))
      throw new Error("Client metadata does not match this deployment.");
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const url = new URL(config.authorizationEndpoint);
    url.search = new URLSearchParams({
      response_type: "code", client_id: config.clientId, redirect_uri: redirect,
      resource: config.endpoint, state, code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      ...(config.scopes.length ? { scope: config.scopes.join(" ") } : {}),
    }).toString();
    pending.set(state, { owner, config, verifier, redirect, expires: Date.now() + 600000 });
    return { authorizationUrl: url.href, flowId: state };
  }

  async function callback(params: URLSearchParams) {
    prune();
    const state = params.get("state") ?? "";
    const flow = pending.get(state);
    if (!flow) throw new Error("Invalid or expired OAuth state.");
    pending.delete(state);
    if (params.getAll("state").length !== 1 || params.getAll("iss").length !== 1 ||
      params.getAll("code").length !== 1 || params.has("error") || params.get("iss") !== flow.config.issuer ||
      JSON.stringify(configuration(flow.config.endpoint)) !== JSON.stringify(flow.config))
      throw new Error("OAuth authorization could not be verified.");
    const code = params.get("code");
    if (!code || code.length > 8192) throw new Error("Invalid authorization code.");
    const tokens = parseTokens(await json(flow.config.tokenEndpoint, request, new URLSearchParams({
      grant_type: "authorization_code", code, client_id: flow.config.clientId, redirect_uri: flow.redirect,
      code_verifier: flow.verifier, resource: flow.config.endpoint,
    })));
    prune();
    if (grants.size >= 50) throw new Error("Too many pending grants.");
    grants.set(state, { owner: flow.owner, grant: { config: flow.config, tokens }, expires: Date.now() + 600000 });
  }
  function grant(owner: string, endpoint: string, flowId: unknown): OAuthGrant {
    prune();
    const item = typeof flowId === "string" ? grants.get(flowId) : undefined;
    if (!item || item.owner !== owner || item.grant.config.endpoint !== endpoint ||
      JSON.stringify(configuration(endpoint)) !== JSON.stringify(item.grant.config))
      throw new Error("Complete OAuth authorization first.");
    return item.grant;
  }
  function consume(flowId: string) { grants.delete(flowId); }
  async function refresh(grant: OAuthGrant): Promise<OAuthGrant> {
    if (JSON.stringify(configuration(grant.config.endpoint)) !== JSON.stringify(grant.config))
      throw new Error("OAuth configuration changed. Reconnect.");
    if (grant.tokens.expiresAt > Date.now() + 60000) return grant;
    if (!grant.tokens.refreshToken) throw new Error("OAuth authorization expired. Reconnect.");
    const tokens = parseTokens(await json(grant.config.tokenEndpoint, request, new URLSearchParams({
      grant_type: "refresh_token", refresh_token: grant.tokens.refreshToken,
      client_id: grant.config.clientId, resource: grant.config.endpoint,
    })), grant.tokens);
    return { config: grant.config, tokens };
  }
  return { endpoints, begin, callback, grant, consume, refresh };
}
