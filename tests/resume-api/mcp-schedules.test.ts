import { describe, expect, it } from "vitest";
import { nextScheduleRun, validScheduleInterval } from "../../packages/resume-api/src/database/repositories/mcp-schedules.ts";
describe("MCP schedule intervals", () => {
  it("allows only supported intervals", () => {
    expect(validScheduleInterval(15)).toBe(true);
    expect(validScheduleInterval(1440)).toBe(true);
    for (const value of [0, 1, -1, 16, "60", null, Infinity]) expect(validScheduleInterval(value)).toBe(false);
  });
  it("advances from the current time rather than replaying missed intervals", () => {
    expect(nextScheduleRun(60, Date.parse("2026-11-25T12:00:00Z"))).toBe("2026-11-25T13:00:00.000Z");
    expect(() => nextScheduleRun(1)).toThrow();
  });
});
