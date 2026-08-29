import type { FreshnessState } from "./types";

export function getFreshnessState(lastSuccessfulSyncAt: string | null | undefined, thresholdMinutes: number, now = new Date()): FreshnessState {
  if (!lastSuccessfulSyncAt) return "never";
  const syncedAt = new Date(lastSuccessfulSyncAt);
  if (Number.isNaN(syncedAt.getTime())) return "never";
  const ageMs = now.getTime() - syncedAt.getTime();
  return ageMs <= thresholdMinutes * 60_000 ? "recent" : "stale";
}

export function formatKolkataDateTime(value: string | null | undefined): string {
  if (!value) return "Never synced";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}
