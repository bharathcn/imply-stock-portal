import clsx from "clsx";
import type { Availability, FreshnessState } from "@/lib/types";

export function AvailabilityBadge({ value }: { value: Availability }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-black",
        value === "In stock" && "bg-emerald-100 text-emerald-800",
        value === "Low stock" && "bg-amber-100 text-amber-800",
        value === "Out of stock" && "bg-red-100 text-red-800",
        value === "Stock unavailable" && "bg-zinc-200 text-zinc-700"
      )}
    >
      {value}
    </span>
  );
}

export function FreshnessBadge({ value }: { value: FreshnessState }) {
  const label = value === "recent" ? "Recently synced" : value === "stale" ? "Last known data" : "Never synced";
  return (
    <span
      className={clsx(
        "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-black",
        value === "recent" && "bg-emerald-100 text-emerald-800",
        value === "stale" && "bg-amber-100 text-amber-900",
        value === "never" && "bg-zinc-200 text-zinc-700"
      )}
    >
      {label}
    </span>
  );
}
