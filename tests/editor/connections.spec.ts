import { test, expect } from "@playwright/test";
import {
  openStore,
  DEFAULT_PROFILE_ID,
} from "../../packages/resume-api/src/database/store.ts";
import { createApiHandler } from "../../packages/resume-api/src/server/app.ts";

test("manages profile connections without exposing the saved token", async ({
  page,
  baseURL,
}) => {
  const previous = process.env.MOYA_CONNECTOR_KEY;
  process.env.MOYA_CONNECTOR_KEY = "ab".repeat(32);
  const store = openStore(":memory:");
  try {
    const handler = createApiHandler(store, { origin: baseURL! });
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      async (route) => {
        const request = route.request();
        const response = await handler({
          method: request.method(),
          url: new URL(request.url()),
          headers: request.headers(),
          readJson: async () => request.postDataJSON(),
        });
        await route.fulfill({ status: response.status, json: response.body });
      },
    );
    await page.goto("/connections");
    await page.getByRole("button", { name: "Add connection" }).click();
    await page.getByLabel("Connection name").fill("Job tracker");
    await page.getByLabel("Personal access token").fill("example-token");
    await page.getByRole("button", { name: "Save connection" }).click();
    await expect(page.getByRole("heading", { name: "Job tracker" })).toBeVisible();
    expect(store.listConnections(DEFAULT_PROFILE_ID)[0].allowWrites).toBe(false);
    await page.reload();
    await page.getByRole("button", { name: "View tools" }).click();
    await expect(page.getByText("list_bases", { exact: true })).toBeVisible();
    await expect(page.getByText("example-token")).toHaveCount(0);
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await page.getByRole("button", { name: "Confirm disconnect" }).click();
    await expect(page.getByText("No saved connections.")).toBeVisible();
    expect(store.listConnections(DEFAULT_PROFILE_ID)).toEqual([]);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.MOYA_CONNECTOR_KEY;
    else process.env.MOYA_CONNECTOR_KEY = previous;
  }
});
