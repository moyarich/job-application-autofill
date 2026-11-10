import { ApiResponse } from "../types/types";

export function reply(
  status: number,
  body: unknown,
  contentType?: string,
): ApiResponse {
  return { status, body, contentType };
}
