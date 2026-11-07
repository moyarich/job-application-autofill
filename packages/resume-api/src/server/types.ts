import type { openStore } from "../database/store.ts";
export type Store = ReturnType<typeof openStore>;
export interface ApiRequest {
  method: string;
  url: URL;
  headers: Record<string, string | string[] | undefined>;
  readJson(): Promise<unknown>;
}
export interface ApiResponse {
  status: number;
  body: unknown;
  contentType?: string;
}
export interface RouteContext {
  req: ApiRequest;
  url: URL;
  store: Store;
  profileId: string;
  resumeIdHeader?: string;
}
export type RouteHandler = (context: RouteContext) => Promise<ApiResponse | undefined>;
export function reply(status: number, body: unknown, contentType?: string): ApiResponse {
  return { status, body, contentType };
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON object.");
  return value as Record<string, unknown>;
}
