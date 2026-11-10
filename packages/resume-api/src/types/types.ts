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
export type RouteHandler = (
  context: RouteContext,
) => Promise<ApiResponse | undefined>;
