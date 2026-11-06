import { test, expect, vi } from "vitest";
import { prepareEmployerSignUp } from "../../packages/job-sites/account-sign-up.ts";
import type { Page } from "playwright";

test("account automation never fills fields on a different host", async () => {
  const fill = vi.fn();
  const page = {
    url: () => "https://unrelated.example.com/signup",
    getByLabel: () => ({ first: () => ({ fill }) }),
  } as unknown as Page;
  const result = await prepareEmployerSignUp(page, "https://acme.wd5.myworkdayjobs.com/Careers/job/42", "Acme",
    { contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" } } as never);
  expect(result.state).toBe("unavailable");
  expect(fill).not.toHaveBeenCalled();
});
