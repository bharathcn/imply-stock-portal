import { describe, expect, it } from "vitest";
import { hashConnectorSecret, verifyConnectorSecret } from "./auth";

describe("connector auth", () => {
  it("verifies a connector secret by hash", () => {
    const hash = hashConnectorSecret("local-secret");
    expect(verifyConnectorSecret("local-secret", hash)).toBe(true);
    expect(verifyConnectorSecret("wrong-secret", hash)).toBe(false);
  });
});
