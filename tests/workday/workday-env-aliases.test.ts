import { expect, it } from "vitest";
import { workdayCredentials } from "../../packages/job-sites/workday/workday-login.ts";
it("reads WORKDAY credentials only for their configured employer host", () => {
  const env = {
    WORKDAY_HOST: "uchicago.wd5.myworkdayjobs.com",
    WORKDAY_USERNAME: "fixture@example.com",
    WORKDAY_PASSWORD: "fixture-password",
    RESUME_SITE_EMAIL: "legacy@example.com",
    RESUME_SITE_PASSWORD: "legacy-password",
  };
  expect(
    workdayCredentials("https://uchicago.wd5.myworkdayjobs.com/login", env),
  ).toEqual({ email: "fixture@example.com", password: "fixture-password" });
  expect(
    workdayCredentials("https://workday.wd5.myworkdayjobs.com/login", env),
  ).toBeNull();
  expect(
    workdayCredentials(
      "https://uchicago.wd5.myworkdayjobs.com.bad.example/login",
      env,
    ),
  ).toBeNull();
  expect(
    workdayCredentials("http://uchicago.wd5.myworkdayjobs.com/login", env),
  ).toBeNull();
});
