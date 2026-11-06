import { it, expect } from "vitest";
import type { Page } from "playwright";
import { helpWorkdaySignIn } from "../../packages/job-sites/workday/workday-login.ts";
const env = {
  WORKDAY_USER_EMAIL: "test@example.com",
  WORKDAY_PASSWORD: "test-only",
};

it("prefills only email on account creation and never sets a new password", async () => {
  const { vi } = await import("vitest");
  const email = { isVisible: async () => true, fill: vi.fn() };
  const password = {
    isVisible: async () => true,
    waitFor: async () => {},
    fill: vi.fn(),
  };
  const hidden = {
    isVisible: async () => false,
    waitFor: async () => {},
    click: vi.fn(),
  };
  const heading = { isVisible: async () => true };
  const page = {
    url: () => "https://workday.wd5.myworkdayjobs.com/create-account",
    getByRole: (role: string) => ({
      first: () => (role === "heading" ? heading : hidden),
      last: () => hidden,
    }),
    getByLabel: (pattern: RegExp) => ({
      first: () => (pattern.test("Email Address") ? email : password),
      last: () => (pattern.test("Email Address") ? email : password),
    }),
    locator: () => ({
      innerText: async () => "Create Account. Confirm password.",
    }),
  };
  await helpWorkdaySignIn({ page: page as unknown as Page }, env);
  expect(email.fill).toHaveBeenCalledWith(env.WORKDAY_USER_EMAIL);
  expect(password.fill).not.toHaveBeenCalled();
  expect(hidden.click).not.toHaveBeenCalled();
});
