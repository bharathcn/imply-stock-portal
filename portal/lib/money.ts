import Decimal from "decimal.js";

export function formatMoney(value: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(new Decimal(value).toNumber());
}
