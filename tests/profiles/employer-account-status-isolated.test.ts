import { test, expect } from "vitest";
import { openStore } from "../../packages/resume-api/src/database/store.ts";

test("employer account setup status is isolated across people and tenant keys", () => {
  const db = openStore(":memory:");
  try {
    const one = db.createProfile("Alice");
    const two = db.createProfile("Bob");
    const acme = { provider: "workday", employerKey: "acme.wd5.myworkdayjobs.com", employerName: "Acme", host: "acme.wd5.myworkdayjobs.com" };
    const beta = { ...acme, employerKey: "beta.wd5.myworkdayjobs.com", employerName: "Beta", host: "beta.wd5.myworkdayjobs.com" };
    expect(db.getOrCreateEmployerAccount(one.id, acme).status).toBe("setup_required");
    db.setEmployerAccountStatus(one.id, acme.provider, acme.employerKey, "ready");
    expect(db.getOrCreateEmployerAccount(one.id, acme).status).toBe("ready");
    expect(db.getOrCreateEmployerAccount(one.id, beta).status).toBe("setup_required");
    expect(db.getOrCreateEmployerAccount(two.id, acme).status).toBe("setup_required");
    expect(db.listAccounts(two.id)).toHaveLength(1);
  } finally { db.close(); }
});
