import { describe, expect, it } from "vitest";

import { makePassword, parsePassword } from "../../docker/dev.ts";

describe("full development stack startup", () => {
  it("generates eight-character credentials and parses quoted values", () => {
    expect(makePassword(Buffer.from("1234567890"))).toMatch(
      /^[A-Za-z0-9_-]{8}$/,
    );
    expect(parsePassword('WEB_VNC_PASSWORD="secure-password"')).toBe(
      "secure-password",
    );
  });
});
