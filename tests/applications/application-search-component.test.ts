import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const source = (path: string) => readFileSync(new URL(
  "../../packages/job-application-autofill/src/components/" + path, import.meta.url,
), "utf8");

test("the reusable application search input supports accessible search and clear actions with Lucide icons", () => {
  const search = source("SearchInput/SearchInput.tsx");
  const opportunities = source("Opportunities/Opportunities.tsx");
  expect(search).toContain('from "lucide-react"');
  expect(search).toContain("<Search ");
  expect(search).toContain("<X ");
  expect(search).toContain('type="search"');
  expect(search).toContain('onChange("")');
  expect(search).toContain('import "./SearchInput.css"');
  expect(opportunities).toContain("<SearchInput");
  expect(opportunities).not.toContain("search-control");
});
