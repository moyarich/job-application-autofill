import { test, expect, vi } from "vitest";
import type { Page } from "playwright";
import { prepareEmployerSignUp } from "../../packages/job-boards/account-sign-up.ts";

test.each(["Short1!x", "secure-once-password-01234"])("employer signup fills employer-compatible password %s without submitting", async (password) => {
  const values: Record<string, string> = {};
  const click = vi.fn();
  const field = (name: string) => ({
    first: () => ({
      isVisible: async () => true,
      isEnabled: async () => true,
      fill: async (value: string) => {
        values[name] = value;
      },
    }),
  });
  const page = {
    url: () => "https://acme.wd5.myworkdayjobs.com/create-account",
    getByRole: (role: string) => ({
      first: () => ({
        isVisible: async () => role === "heading",
        click,
      }),
    }),
    getByLabel: (label: RegExp) => field(String(label)),
  } as unknown as Page;
  const result = await prepareEmployerSignUp(
    page,
    "https://acme.wd5.myworkdayjobs.com/Careers/job/42",
    "Acme",
    {
      contact: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      },
    } as never,
    { password },
  );
  expect(result.state).toBe("manual_required");
  expect(result.filled).toEqual([
    "firstName",
    "lastName",
    "email",
    "password",
    "confirmPassword",
  ]);
  expect(values["/e.?mail/i"]).toBe("ada@example.com");
  expect(values["/^(?:new )?password\\s*\\*?$/i"]).toBe(
    password,
  );
  expect(click).not.toHaveBeenCalled();
});

test("Workday signup uses configured credentials without returning them to the dashboard", async () => {
  vi.stubEnv("WORKDAY_USERNAME", "configured@example.com");
  vi.stubEnv("WORKDAY_PASSWORD", "fixture-configured-password");
  const values: Record<string, string> = {};
  const field = (name: string) => ({
    first: () => ({
      isVisible: async () => true,
      isEnabled: async () => true,
      fill: async (value: string) => {
        values[name] = value;
      },
    }),
  });
  const page = {
    url: () => "https://workday.wd5.myworkdayjobs.com/create-account",
    getByRole: () => ({ first: () => ({ isVisible: async () => true }) }),
    getByLabel: (label: RegExp) => field(String(label)),
  } as unknown as Page;
  try {
    const result = await prepareEmployerSignUp(
      page,
      "https://workday.wd5.myworkdayjobs.com/Workday/job/42",
      "Workday",
      {
        contact: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "resume@example.com",
        },
      } as never,
    );
    expect(values["/e.?mail/i"]).toBe("configured@example.com");
    expect(values["/^(?:new )?password\\s*\\*?$/i"]).toBe(
      "fixture-configured-password",
    );
    expect(result.credentialSource).toBe("configured");
    expect(JSON.stringify(result)).not.toContain("configured@example.com");
    expect(JSON.stringify(result)).not.toContain("fixture-configured-password");
  } finally {
    vi.unstubAllEnvs();
  }
});

test("uses configured Workday credentials for the explicitly selected employer", async () => {
  vi.stubEnv("WORKDAY_USERNAME", "configured@example.com");
  vi.stubEnv("WORKDAY_PASSWORD", "fixture-configured-password");
  const values: Record<string, string> = {};
  const page = {
    url: () => "https://cardinalhealth.wd1.myworkdayjobs.com/create-account",
    getByRole: () => ({ first: () => ({ isVisible: async () => true }) }),
    getByLabel: (label: RegExp) => ({
      first: () => ({
        isVisible: async () => true,
        isEnabled: async () => true,
        fill: async (value: string) => {
          values[String(label)] = value;
        },
      }),
    }),
  } as unknown as Page;
  try {
    const result = await prepareEmployerSignUp(
      page,
      "https://cardinalhealth.wd1.myworkdayjobs.com/en-US/EXT/job/42",
      "Cardinal Health",
      {
        contact: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "resume@example.com",
        },
      } as never,
    );
    expect(result.filled).toContain("password");
    expect(result.filled).toContain("confirmPassword");
    expect(values["/e.?mail/i"]).toBe("configured@example.com");
    expect(result.credentialSource).toBe("configured");
    expect(JSON.stringify(result)).not.toContain("fixture-configured-password");
  } finally {
    vi.unstubAllEnvs();
  }
});
