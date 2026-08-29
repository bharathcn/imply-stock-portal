import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { hashConnectorSecret } from "@/lib/connector/auth";

describe("connector snapshot route", () => {
  it("returns 401 for a bad connector secret", async () => {
    await withEnv({ CONNECTOR_SECRET_HASH: hashConnectorSecret("expected-secret") }, async () => {
      const response = await POST(jsonRequest(validPayload(), "wrong-secret"));

      expect(response.status).toBe(401);
    });
  });

  it("rejects invalid snapshots before development-mode acceptance", async () => {
    await withEnv({ CONNECTOR_SECRET_HASH: hashConnectorSecret("expected-secret") }, async () => {
      const payload = validPayload();
      payload.items[0].totalQuantity = 1 as unknown as string;

      const response = await POST(jsonRequest(payload, "expected-secret"));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Invalid payload");
      expect(body.details.fieldErrors.items).toBeDefined();
    });
  });

  it("accepts a realistic 900 item snapshot in development mode", async () => {
    await withEnv({ CONNECTOR_SECRET_HASH: hashConnectorSecret("expected-secret") }, async () => {
      const payload = validPayload(900);

      const response = await POST(jsonRequest(payload, "expected-secret"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.accepted).toBe(true);
      expect(body.developmentMode).toBe(true);
      expect(body.unmappedItemCount).toBe(900);
    });
  });
});

function validPayload(itemCount = 1) {
  return {
    connectorId: "office-main",
    requestId: "11111111-1111-4111-8111-111111111111",
    tallyCompany: "Development Company",
    syncStartedAt: "2026-08-20T10:00:00.000Z",
    syncCompletedAt: "2026-08-20T10:00:10.000Z",
    connectorVersion: "0.1.0",
    items: Array.from({ length: itemCount }, (_, index) => ({
      tallyItemName: `IMPLY ROYAL ${index.toString().padStart(4, "0")} 18MM 8X4 BWP`,
      totalQuantity: (index % 3 === 0 ? "0" : index % 3 === 1 ? "42.125" : "-1.5"),
      unit: "sheets",
      godowns: [
        { godownName: "Main Warehouse", quantity: "30.125" },
        { godownName: "Showroom", quantity: index % 2 === 0 ? "12" : "-0.5" }
      ]
    }))
  };
}

function jsonRequest(payload: unknown, secret: string) {
  return new Request("http://localhost/api/connector/snapshot", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-connector-secret": secret
    },
    body: JSON.stringify(payload)
  });
}

async function withEnv(values: Record<string, string>, callback: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  previous.set("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  previous.set("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
