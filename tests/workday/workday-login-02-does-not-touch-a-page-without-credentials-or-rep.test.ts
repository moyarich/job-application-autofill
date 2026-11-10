import { describe, it, expect } from "vitest";
import type { Page } from "playwright";
import { helpWorkdaySignIn } from "../../packages/job-boards/workday/workday-login.ts";
const env = {
  WORKDAY_USER_EMAIL: "test@example.com",
  WORKDAY_PASSWORD: "test-only",
};
describe("Workday environment credentials", () => {
  it("does not touch a page without credentials or repeat an attempt", async () => {
    const page = { url: () => "https://workday.wd5.myworkdayjobs.com/apply" };
    await expect(
      helpWorkdaySignIn({ page: page as unknown as Page }, {}),
    ).resolves.toBeUndefined();
    await expect(
      helpWorkdaySignIn(
        { page: page as unknown as Page, loginAttempted: true },
        env,
      ),
    ).resolves.toBeUndefined();
  });
});
