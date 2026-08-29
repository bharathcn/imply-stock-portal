import type { ProductWithInventory } from "./types";

export const selectionOrder = ["brand", "product_family", "thickness", "size", "grade"] as const;
export type SelectionKey = (typeof selectionOrder)[number];
export type Selection = Partial<Record<SelectionKey, string>>;

export function validOptions(products: ProductWithInventory[], selection: Selection, key: SelectionKey): string[] {
  const keyIndex = selectionOrder.indexOf(key);
  const priorKeys = selectionOrder.slice(0, keyIndex);
  const values = products
    .filter((product) => priorKeys.every((prior) => !selection[prior] || product[prior] === selection[prior]))
    .map((product) => product[key]);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function findSelectedProduct(products: ProductWithInventory[], selection: Selection): ProductWithInventory | null {
  if (!selectionOrder.every((key) => selection[key])) return null;
  return products.find((product) => selectionOrder.every((key) => product[key] === selection[key])) ?? null;
}
