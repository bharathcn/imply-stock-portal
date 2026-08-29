import { describe, expect, it } from "vitest";
import { getAvailability } from "./availability";

describe("availability", () => {
  it("uses the low-stock threshold", () => {
    expect(getAvailability(42, 10)).toBe("In stock");
    expect(getAvailability(8, 10)).toBe("Low stock");
    expect(getAvailability(0, 10)).toBe("Out of stock");
    expect(getAvailability(null, 10)).toBe("Stock unavailable");
  });
});
