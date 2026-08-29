import { createHash, timingSafeEqual } from "node:crypto";

export function hashConnectorSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("base64url");
}

export function verifyConnectorSecret(secret: string | null, expectedHash: string | undefined): boolean {
  if (!secret || !expectedHash) return false;
  const actual = Buffer.from(hashConnectorSecret(secret));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
