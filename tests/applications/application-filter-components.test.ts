import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const source = (path: string) => readFileSync(new URL(
  "../../packages/job-application-autofill/src/components/" + path, import.meta.url,
), "utf8");

test("application filters reuse an accessible Lucide-icon select component", () => {
  const select = source("SelectFilter/SelectFilter.tsx");
  const filters = source("ApplicationFilters/ApplicationFilters.tsx");
  const opportunities = source("Opportunities/Opportunities.tsx");
  expect(select).toContain("<Icon ");
  expect(select).toContain("<ChevronDown ");
  expect(select).toContain("htmlFor={id}");
  expect(select).toContain('import "./SelectFilter.css"');
  expect(filters).toContain("ListFilter");
  expect(filters).toContain("ArrowDownUp");
  expect(filters).toContain('<SelectFilter label="Filter applications by status"');
  expect(filters).toContain('<SelectFilter label="Sort applications"');
  expect(opportunities).toContain("<ApplicationFilters");
  expect(opportunities).not.toContain("opportunity-select-control");
});
