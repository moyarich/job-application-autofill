import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8");

describe("job-application-autofill application naming", () => {
  it("persists SQLite in the host bind mount and retains its database filename", () => {
    expect(source("docker-compose.yml")).toContain(
      "name: job-application-autofill",
    );
    expect(source("docker-compose.yml")).toContain("./sqlite-data:/app/data");
    expect(source("packages/resume-api/src/database/store.ts")).toContain(
      "data/job_application_autofill.sqlite",
    );
  });
});
