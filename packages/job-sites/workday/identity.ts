/**
 * Workday employer accounts are scoped to an exact tenant hostname.
 * A generic workday.com hostname is not an employer-specific account.
 */
export function workdayEmployerTenant(host: string): string | undefined {
  const normalized = host.toLowerCase();
  return normalized.endsWith(".myworkdayjobs.com")
    ? normalized
    : undefined;
}
