// @ts-nocheck — migrated test fixtures retain runtime assertions.
import { describe, expect, it, vi } from "vitest";
import { validateUrl, isSubmissionConfirmed, fillKnownFields, prepareApplication, getActiveApplication, closeApplication } from "../packages/job-sites/automation.ts";

describe("application safety", () => {
  it("permits known ATS sites only over HTTPS", () => {
    expect(validateUrl("https://jobs.lever.co/example/role")).toBe("https://jobs.lever.co/example/role");
    expect(() => validateUrl("https://jobs.lever.co.evil.example/job")).toThrow();
    expect(() => validateUrl("http://jobs.lever.co/example/job")).toThrow();
    expect(() => validateUrl("https://user:pass@jobs.lever.co/job")).toThrow();
  });
  it("does not treat clicking submit as confirmation", () => {
    expect(isSubmissionConfirmed("Submit your application")).toBe(false);
    expect(isSubmissionConfirmed("Thank you for your application!")).toBe(true);
    expect(isSubmissionConfirmed("Your application has been received")).toBe(true);
  });
  it("fills matching controls and reports unmatched fields", async () => {
    const target = { isVisible:vi.fn().mockResolvedValue(true), isEnabled:vi.fn().mockResolvedValue(true), fill:vi.fn().mockResolvedValue(undefined) };
    const missing = { isVisible:vi.fn().mockResolvedValue(false), isEnabled:vi.fn(), fill:vi.fn() };
    const page = {
      getByLabel: vi.fn((pattern) => ({ first:() => pattern.test("First Name") ? target : missing })),
      getByPlaceholder: vi.fn(() => ({ first:() => missing })),
    };
    const results = await fillKnownFields(page, { contact: { firstName:"Ada", email:"ada@example.com" } });
    expect(results.filled).toEqual(["firstName"]);
    expect(results.missing).toEqual(["email"]);
    expect(target.fill).toHaveBeenCalledWith("Ada", { timeout:2500 });
  });
});

it("keeps concurrent applications separate and closes only the requested session", async () => {
  function browserFor(url) {
    const page = { goto: async()=>{}, waitForTimeout: async()=>{}, url:()=>url,
      locator:()=>({innerText:async()=>"Create an account to continue"}) };
    return {newContext:async()=>({newPage:async()=>page}),close:async()=>{}};
  }
  const firstJob="aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa",secondJob="bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb";
  const firstUrl="https://jobs.lever.co/example/a",secondUrl="https://boards.greenhouse.io/example/jobs/1";
  let first, second;
  try {
    [first,second]=await Promise.all([
      prepareApplication({jobId:firstJob,jobUrl:firstUrl,profile:{},launchBrowser:async()=>browserFor(firstUrl)}),
      prepareApplication({jobId:secondJob,jobUrl:secondUrl,profile:{},launchBrowser:async()=>browserFor(secondUrl)})
    ]);
    expect(first.id).not.toBe(second.id);
    expect(getActiveApplication(firstJob).id).toBe(first.id);
    expect(getActiveApplication(secondJob).id).toBe(second.id);
    await expect(prepareApplication({jobId:firstJob,jobUrl:firstUrl,profile:{}})).rejects.toThrow("already has an open");
    await closeApplication(first.id);
    expect(getActiveApplication(firstJob)).toBeNull();
    expect(getActiveApplication(secondJob).id).toBe(second.id);
  } finally {
    if(first)await closeApplication(first.id);
    if(second)await closeApplication(second.id);
  }
});
