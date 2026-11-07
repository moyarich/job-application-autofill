import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createApiHandler } from "../../packages/resume-api/src/server/app.ts";
import { DEFAULT_PROFILE_ID, openStore } from "../../packages/resume-api/src/database/store.ts";
import type { ApiRequest } from "../../packages/resume-api/src/server/types.ts";

const profile = JSON.parse(readFileSync(
  new URL("../../packages/resume/src/resume-schema/resume.example.json", import.meta.url),
  "utf8",
));
const job = {
  id: "e8796d4c-828e-4634-aa60-ab39bc95e241",
  company: "Example", role: "Engineer", url: "https://example.com/jobs/1",
  status: "saved", createdAt: "2026-11-05T12:00:00.000Z", notes: "",
};

const request = (path: string, method = "GET", body?: unknown): ApiRequest => ({
  method, url: new URL(path, "http://localhost"),
  headers: { "x-moya-client": "dashboard", "x-profile-id": DEFAULT_PROFILE_ID },
  readJson: async () => body,
});

describe("independent persistence endpoints", () => {
  it("saves resume, jobs and contacts separately without overwriting another domain", async () => {
    const store = openStore(":memory:");
    try {
      const api = createApiHandler(store, { origin: "http://localhost" });
      const version = store.listResumes(DEFAULT_PROFILE_ID)[0];
      const contentPath = "/api/resumes/" + version.id + "/content";

      expect((await api(request("/api/state"))).status).toBe(404);
      expect((await api(request(contentPath))).body).toMatchObject({ revision: 0, profile: null });
      expect((await api(request("/api/jobs"))).body).toEqual({ revision: 0, jobs: [] });

      expect((await api(request(contentPath, "PUT", {
        revision: 0, profile, contactId: null,
      }))).status).toBe(200);
      expect((await api(request("/api/jobs"))).body).toEqual({ revision: 0, jobs: [] });
      expect((await api(request("/api/profile-contacts"))).body).toEqual({ contacts: [] });

      expect((await api(request("/api/jobs", "PUT", {
        revision: 0, job,
      }))).status).toBe(200);
      expect((await api(request(contentPath))).body).toMatchObject({
        revision: 1, profile, contactId: null,
      });

      const contactResult = await api(request("/api/profile-contacts", "POST", {
        name: "Personal", contact: profile.contact,
      }));
      expect(contactResult.status).toBe(201);
      const contact = contactResult.body as { id: string };

      const linked = await api(request(contentPath, "PUT", {
        revision: 1, profile, contactId: contact.id,
      }));
      expect(linked.status).toBe(200);
      expect((await api(request("/api/jobs"))).body).toEqual({ revision: 1, jobs: [job] });

      const changedContact = { ...profile.contact, phone: "555-0199" };
      expect((await api(request("/api/profile-contacts/" + contact.id, "PATCH", {
        name: "Personal", contact: changedContact,
      }))).status).toBe(200);
      expect((await api(request(contentPath))).body).toMatchObject({
        revision: 2, contactId: contact.id,
        profile: { contact: changedContact },
      });
      expect((await api(request("/api/jobs"))).body).toEqual({ revision: 1, jobs: [job] });
      expect((await api(request(contentPath, "PUT", {
        revision: 1, profile, contactId: contact.id,
      }))).status).toBe(409);
    } finally { store.close(); }
  });

  it("changing one application status leaves resume and other jobs intact", async () => {
    const store = openStore(":memory:");
    try {
      const api = createApiHandler(store, { origin: "http://localhost" });
      const resumeId = store.listResumes(DEFAULT_PROFILE_ID)[0].id;
      store.saveResumeContent({ revision: 0, profile, contactId: null }, DEFAULT_PROFILE_ID, resumeId);
      const other = { ...job, id: "214b88fe-4b66-4abe-917a-45c95d07ac01" };
      store.saveJobList({ revision: 0, job }, DEFAULT_PROFILE_ID);
      expect((await api(request("/api/jobs/" + job.id + "/status", "POST", {
        status: "interview",
      }))).status).toBe(200);
      const jobs = (await api(request("/api/jobs"))).body as {
        revision: number; jobs: typeof job[];
      };
      expect(jobs.revision).toBe(3);
      expect(jobs.jobs.find((item) => item.id === job.id)?.status).toBe("interview");
      expect(jobs.jobs.find((item) => item.id === other.id)?.status).toBe("saved");
      expect(store.getResumeContent(DEFAULT_PROFILE_ID, resumeId).revision).toBe(1);
    } finally { store.close(); }
  });

  it("upserts and deletes individual jobs without touching other records", async () => {
    const store = openStore(":memory:");
    try {
      const api = createApiHandler(store, { origin: "http://localhost" });
      const second = { ...job, id: "214b88fe-4b66-4abe-917a-45c95d07ac01" };
      expect((await api(request("/api/jobs", "PUT", { revision: 0, job }))).status).toBe(200);
      expect((await api(request("/api/jobs", "PUT", { revision: 1, job: second }))).status).toBe(200);
      expect((await api(request("/api/jobs", "PUT", { revision: 2, job: { ...job, notes: "Edited" } }))).status).toBe(200);
      expect((await api(request("/api/jobs"))).body).toMatchObject({ revision: 3, jobs: expect.arrayContaining([second, { ...job, notes: "Edited" }]) });
      expect((await api(request("/api/jobs/" + job.id, "DELETE", { revision: 3 }))).status).toBe(200);
      expect((await api(request("/api/jobs"))).body).toEqual({ revision: 4, jobs: [second] });
      expect((await api(request("/api/jobs", "PUT", { revision: 2, job }))).status).toBe(409);
    } finally { store.close(); }
  });
});
