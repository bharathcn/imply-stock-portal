import type { Availability } from "./types";

export function getAvailability(totalQuantity: number | null, lowStockThreshold: number): Availability {
  if (totalQuantity === null) return "Stock unavailable";
  if (totalQuantity <= 0) return "Out of stock";
  if (totalQuantity <= lowStockThreshold) return "Low stock";
  return "In stock";
}
