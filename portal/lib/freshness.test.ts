import { describe, expect, it } from "vitest";
import { getFreshnessState } from "./freshness";

describe("freshness", () => {
  it("labels stale and never-synced data without calling it live", () => {
    const now = new Date("2026-08-20T10:10:00.000Z");
    expect(getFreshnessState("2026-08-20T10:05:00.000Z", 10, now)).toBe("recent");
    expect(getFreshnessState("2026-08-20T09:30:00.000Z", 10, now)).toBe("stale");
    expect(getFreshnessState(null, 10, now)).toBe("never");
  });
});
