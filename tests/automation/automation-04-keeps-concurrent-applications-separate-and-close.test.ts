import { expect, it } from "vitest";
import type { Browser } from "playwright";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";
import { prepareApplication, getActiveApplication, closeApplication } from "../../packages/job-sites/automation.ts";

it("keeps concurrent applications separate and closes only the requested session", async () => {
  function browserFor(url: string): Browser {
    const page = { goto: async()=>{}, waitForTimeout: async()=>{}, url:()=>url,
      locator:()=>({innerText:async()=>"Create an account to continue"}) };
    return {newContext:async()=>({newPage:async()=>page}),close:async()=>{}} as unknown as Browser;
  }
  const firstJob="aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa",secondJob="bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb";
  const firstUrl="https://jobs.lever.co/example/a",secondUrl="https://boards.greenhouse.io/example/jobs/1";
  let first, second;
  try {
    [first,second]=await Promise.all([
      prepareApplication({jobId:firstJob,jobUrl:firstUrl,profile:emptyCandidate,launchBrowser:async()=>browserFor(firstUrl)}),
      prepareApplication({jobId:secondJob,jobUrl:secondUrl,profile:emptyCandidate,launchBrowser:async()=>browserFor(secondUrl)})
    ]);
    expect(first.id).not.toBe(second.id);
    expect(getActiveApplication(firstJob)?.id).toBe(first.id);
    expect(getActiveApplication(secondJob)?.id).toBe(second.id);
    await expect(prepareApplication({jobId:firstJob,jobUrl:firstUrl,profile:emptyCandidate})).rejects.toThrow("already has an open");
    await closeApplication(first.id);
    expect(getActiveApplication(firstJob)).toBeNull();
    expect(getActiveApplication(secondJob)?.id).toBe(second.id);
  } finally {
    if(first)await closeApplication(first.id);
    if(second)await closeApplication(second.id);
  }
});
