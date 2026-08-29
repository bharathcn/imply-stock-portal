import { describe, expect, it } from "vitest";
import { inventorySnapshotSchema } from "./schema";

describe("connector schema", () => {
  it("rejects invalid snapshot payloads", () => {
    const result = inventorySnapshotSchema.safeParse({ connectorId: "office" });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid snapshot", () => {
    const result = inventorySnapshotSchema.safeParse({
      connectorId: "office-main",
      requestId: "11111111-1111-4111-8111-111111111111",
      tallyCompany: "Development Company",
      syncStartedAt: "2026-08-20T10:00:00.000Z",
      syncCompletedAt: "2026-08-20T10:00:10.000Z",
      connectorVersion: "0.1.0",
      items: [
        {
          tallyItemName: "IMPLY ROYAL 18MM 8X4 BWP",
          totalQuantity: "42",
          unit: "sheets",
          godowns: [{ godownName: "RR Nagar", quantity: "30" }]
        }
      ]
    });
    expect(result.success).toBe(true);
  });
});
