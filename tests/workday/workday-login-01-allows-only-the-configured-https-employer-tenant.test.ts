import { describe, it, expect } from "vitest";

import { workdayCredentials } from "../../packages/job-sites/workday/workday-login.ts";
const env = {
  WORKDAY_USER_EMAIL: "test@example.com",
  WORKDAY_PASSWORD: "test-only",
};
describe("Workday environment credentials", () => {
  it("allows only the configured HTTPS employer tenant", () => {
    expect(
      workdayCredentials("https://workday.wd5.myworkdayjobs.com/apply", env),
    ).toEqual({
      email: env.WORKDAY_USER_EMAIL,
      password: env.WORKDAY_PASSWORD,
    });
    for (const url of [
      "https://other.wd5.myworkdayjobs.com/apply",
      "http://workday.wd5.myworkdayjobs.com",
      "https://workday.wd5.myworkdayjobs.com.evil.example",
      "https://accounts.google.com",
      "https://user:pass@workday.wd5.myworkdayjobs.com",
    ])
      expect(workdayCredentials(url, env)).toBeNull();
  });
});
