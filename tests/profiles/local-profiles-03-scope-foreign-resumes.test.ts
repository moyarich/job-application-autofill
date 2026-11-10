import { test, expect } from "vitest";
import { openStore } from "../../packages/resume-api/src/database/store.ts";

test("a resume version from another person cannot be loaded, changed, or deleted", () => {
  const db = openStore(":memory:");
  try {
    const alice = db.createProfile("Alice");
    const bob = db.createProfile("Bob");
    const aliceResume = db.createResume(alice.id, "Alice resume");
    expect(() => db.getResumeContent(bob.id, aliceResume.id)).toThrow(
      /not found/i,
    );
    expect(() => db.renameResume(bob.id, aliceResume.id, "Stolen")).toThrow(
      /not found/i,
    );
    expect(() => db.deleteResume(bob.id, aliceResume.id)).toThrow(/not found/i);
    expect(() =>
      db.saveResumeContent(
        { revision: 0, profile: null, contactId: null },
        bob.id,
        aliceResume.id,
      ),
    ).toThrow(/not found/i);
  } finally {
    db.close();
  }
});
