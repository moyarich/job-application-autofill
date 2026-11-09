import type { JobApplication, ApplicationStatus } from "../../index";

export type ApplicationSort = "newest" | "oldest" | "company" | "role" | "status";
export type ApplicationFilter = ApplicationStatus | "all";

export function searchApplications(
  jobs: readonly JobApplication[],
  search: string,
  status: ApplicationFilter,
  sort: ApplicationSort,
): JobApplication[] {
  const terms = search.normalize("NFKC").trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const result = jobs.filter((job) => {
    if (status !== "all" && job.status !== status) return false;
    const searchable = [
      job.company,
      job.role,
      job.url,
      job.notes,
      job.status.replaceAll("_", " "),
    ].join(" ").normalize("NFKC").toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  return result.sort((a, b) => {
    const order = sort === "company" ? collator.compare(a.company, b.company)
      : sort === "role" ? collator.compare(a.role, b.role)
      : sort === "status" ? collator.compare(a.status, b.status)
      : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt);
    return order || a.id.localeCompare(b.id);
  });
}

export function paginateApplications<T>(items: readonly T[], page: number, pageSize: number) {
  const safeSize = Math.max(1, Math.floor(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(items.length / safeSize));
  const currentPage = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
  const start = (currentPage - 1) * safeSize;
  return {
    page: currentPage,
    pageCount,
    start: items.length ? start + 1 : 0,
    end: Math.min(items.length, start + safeSize),
    total: items.length,
    items: items.slice(start, start + safeSize),
  };
}
