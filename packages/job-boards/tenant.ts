/** First path component identifies the employer on shared job-board hosts. */
export function firstPathTenant(url: URL): string | undefined {
  return url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
}
