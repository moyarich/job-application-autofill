import { test, expect, vi } from "vitest";
import type { Page } from "playwright";
import { prepareEmployerSignUp } from "../../packages/job-sites/account-sign-up.ts";

test("employer signup fills contact identity and one-time passwords without submitting", async () => {
  const values: Record<string, string> = {};
  const click = vi.fn();
  const field = (name: string) => ({
    first: () => ({
      isVisible: async () => true, isEnabled: async () => true,
      fill: async (value: string) => { values[name] = value; },
    }),
  });
  const page = {
    url: () => "https://acme.wd5.myworkdayjobs.com/create-account",
    getByRole: (role: string) => ({ first: () => ({
      isVisible: async () => role === "heading", click,
    }) }),
    getByLabel: (label: RegExp) => field(String(label)),
  } as unknown as Page;
  const result = await prepareEmployerSignUp(page,
    "https://acme.wd5.myworkdayjobs.com/Careers/job/42", "Acme",
    { contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" } } as never,
    { password: "secure-once-password-01234" });
  expect(result.state).toBe("manual_required");
  expect(result.filled).toEqual(["firstName", "lastName", "email", "password", "confirmPassword"]);
  expect(values["/e.?mail/i"]).toBe("ada@example.com");
  expect(values["/^(?:new )?password\\s*\\*?$/i"]).toBe("secure-once-password-01234");
  expect(click).not.toHaveBeenCalled();
});
