import { expect, it } from "vitest";
import type { Browser } from "playwright";
import { emptyCandidate } from "../../packages/job-application-autofill/src/index.ts";
import {
  prepareApplication,
  getActiveApplication,
  closeApplication,
  refreshApplicationState,
} from "../../packages/job-boards/automation.ts";

it("keeps concurrent applications separate and closes only the requested session", async () => {
  function browserFor(url: string): Browser {
    const page = {
      goto: async () => {},
      waitForTimeout: async () => {},
      url: () => url,
      locator: () => ({
        innerText: async () => "Create an account to continue",
      }),
    };
    return {
      newContext: async () => ({ newPage: async () => page }),
      close: async () => {},
    } as unknown as Browser;
  }
  const firstJob = "aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa",
    secondJob = "bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb";
  const firstUrl = "https://jobs.lever.co/example/a",
    secondUrl = "https://boards.greenhouse.io/example/jobs/1";
  let first, second;
  try {
    [first, second] = await Promise.all([
      prepareApplication({
        jobId: firstJob,
        jobUrl: firstUrl,
        profile: emptyCandidate,
        launchBrowser: async () => browserFor(firstUrl),
      }),
      prepareApplication({
        jobId: secondJob,
        jobUrl: secondUrl,
        profile: emptyCandidate,
        launchBrowser: async () => browserFor(secondUrl),
      }),
    ]);
    expect(first.id).not.toBe(second.id);
    expect(getActiveApplication(firstJob)?.id).toBe(first.id);
    expect(getActiveApplication(secondJob)?.id).toBe(second.id);
    await expect(
      prepareApplication({
        jobId: firstJob,
        jobUrl: firstUrl,
        profile: emptyCandidate,
      }),
    ).rejects.toThrow("already has an open");
    await closeApplication(first.id);
    expect(getActiveApplication(firstJob)).toBeNull();
    expect(getActiveApplication(secondJob)?.id).toBe(second.id);
  } finally {
    if (first) await closeApplication(first.id);
    if (second) await closeApplication(second.id);
  }
});

it("refreshes status after manual sign-in without running automation", async () => {
  let text = "Create an account to continue";
  const url = "https://jobs.lever.co/example/manual-login";
  const browser = {
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {},
        waitForTimeout: async () => {},
        url: () => url,
        locator: () => ({ innerText: async () => text }),
      }),
    }),
    close: async () => {},
  } as unknown as Browser;
  const session = await prepareApplication({
    jobId: "manual-login",
    jobUrl: url,
    profile: emptyCandidate,
    launchBrowser: async () => browser,
  });
  try {
    expect(session.state).toBe("login_required");
    text = "My Information\nApplication";
    const refreshed = await refreshApplicationState(session.id);
    expect(refreshed.state).toBe("ready_for_review");
    expect(refreshed.message).toContain("current page");
    expect(refreshed.filled).toEqual([]);
    text = "Create an account to continue";
    expect((await refreshApplicationState(session.id)).state).toBe(
      "login_required",
    );
  } finally {
    await closeApplication(session.id);
  }
});

it.each(["page", "browser"])(
  "allows reopening after the employer %s closes unexpectedly",
  async (closedTarget) => {
    let closed = false;
    const url = "https://jobs.lever.co/example/closed-session";
    const launchBrowser = async () =>
      ({
        isConnected: () => closedTarget !== "browser" || !closed,
        newContext: async () => ({
          newPage: async () => ({
            isClosed: () => closedTarget === "page" && closed,
            goto: async () => {},
            waitForTimeout: async () => {},
            url: () => url,
            locator: () => ({
              innerText: async () => "Create an account to continue",
            }),
          }),
        }),
        close: async () => {},
      }) as unknown as Browser;
    const jobId = "closed-session-" + closedTarget;
    let reopened;
    try {
      const first = await prepareApplication({
        jobId,
        jobUrl: url,
        profile: emptyCandidate,
        launchBrowser,
      });
      closed = true;
      expect(getActiveApplication(jobId)).toBeNull();
      closed = false;
      reopened = await prepareApplication({
        jobId,
        jobUrl: url,
        profile: emptyCandidate,
        launchBrowser,
      });
      expect(reopened.id).not.toBe(first.id);
      expect(getActiveApplication(jobId)?.id).toBe(reopened.id);
    } finally {
      if (reopened) await closeApplication(reopened.id);
    }
  },
);
