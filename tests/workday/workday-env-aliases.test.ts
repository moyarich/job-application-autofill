import { expect, it } from "vitest";
import { workdayCredentials } from "../../packages/job-sites/workday/workday-login.ts";
it("reads WORKDAY credentials for the employer selected by the job URL", () => {
  const env = {
    WORKDAY_USERNAME: "fixture@example.com",
    WORKDAY_PASSWORD: "fixture-password",
    RESUME_SITE_EMAIL: "legacy@example.com",
    RESUME_SITE_PASSWORD: "legacy-password",
  };
  expect(
    workdayCredentials("https://uchicago.wd5.myworkdayjobs.com/login", env, { employerHost: "uchicago.wd5.myworkdayjobs.com" }),
  ).toEqual({ email: "fixture@example.com", password: "fixture-password" });
  expect(
    workdayCredentials("https://workday.wd5.myworkdayjobs.com/login", env, { employerHost: "uchicago.wd5.myworkdayjobs.com" }),
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
