"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAvailability } from "@/lib/availability";
import { findSelectedProduct, selectionOrder, type Selection, validOptions } from "@/lib/catalog";
import { getFreshnessState, formatKolkataDateTime } from "@/lib/freshness";
import { formatMoney } from "@/lib/money";
import type { ProductWithInventory, Role } from "@/lib/types";
import { AvailabilityBadge, FreshnessBadge } from "./StatusBadge";

const labels = {
  brand: "Brand",
  product_family: "Product family",
  thickness: "Thickness",
  size: "Size",
  grade: "Grade"
};

const storageKey = "imply:last-selection";

export function StockLookup({ products, role, freshnessThresholdMinutes }: { products: ProductWithInventory[]; role: Role; freshnessThresholdMinutes: number }) {
  const [selection, setSelection] = useState<Selection>({});
  const selectedProduct = useMemo(() => findSelectedProduct(products, selection), [products, selection]);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) setSelection(JSON.parse(stored) as Selection);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(selection));
  }, [selection]);

  function updateSelection(key: keyof typeof labels, value: string) {
    const keyIndex = selectionOrder.indexOf(key);
    const next: Selection = {};
    selectionOrder.slice(0, keyIndex).forEach((prior) => {
      next[prior] = selection[prior];
    });
    next[key] = value;
    setSelection(next);
  }

  const quantity = selectedProduct?.inventory_current ? Number(selectedProduct.inventory_current.total_quantity) : null;
  const availability = selectedProduct ? getAvailability(quantity, selectedProduct.low_stock_threshold) : null;
  const freshness = selectedProduct ? getFreshnessState(selectedProduct.inventory_current?.last_successful_sync_at, freshnessThresholdMinutes) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-widest text-amber-800">PRODUCT LOOKUP</p>
            <h2 className="mt-1 text-2xl font-black tracking-normal text-imply-ink">Check availability</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Choose a valid product combination. Out-of-stock products remain visible.</p>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-stone-300 bg-imply-paper text-imply-green"
            onClick={() => setSelection({})}
            aria-label="Clear product selection"
            title="Clear"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-3">
          {selectionOrder.map((key) => {
            const options = validOptions(products, selection, key);
            return (
              <label className="grid gap-2 text-sm font-bold text-zinc-700" key={key}>
                {labels[key]}
                <select
                  className="h-12 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 text-base font-bold text-imply-ink"
                  value={selection[key] ?? ""}
                  onChange={(event) => updateSelection(key, event.target.value)}
                >
                  <option value="">Select {labels[key].toLowerCase()}</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft sm:p-5" aria-live="polite">
        {!selectedProduct || !availability || !freshness ? (
          <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-amber-800">Awaiting selection</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Complete all dropdowns to view quantity, price, godown balances, and sync freshness.</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-widest text-amber-800">SELECTED PRODUCT</p>
                <h2 className="mt-1 text-2xl font-black text-imply-ink">
                  {selectedProduct.brand} {selectedProduct.product_family}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {selectedProduct.thickness} / {selectedProduct.size} / {selectedProduct.grade}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AvailabilityBadge value={availability} />
                <FreshnessBadge value={freshness} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric label={freshness === "recent" ? "Total stock" : "Last known stock"} value={quantity === null ? "Unavailable" : `${quantity} ${selectedProduct.unit}`} />
              <Metric label="Custom selling price" value={formatMoney(selectedProduct.custom_selling_price)} />
            </div>

            <div className="mt-4 rounded-lg border border-stone-200">
              <div className="border-b border-stone-200 px-4 py-3 text-sm font-black text-imply-green">Godown-wise quantity</div>
              {selectedProduct.inventory_by_godown.length ? (
                <div className="divide-y divide-stone-200">
                  {selectedProduct.inventory_by_godown.map((godown) => (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm" key={godown.godown_name}>
                      <span className="font-bold text-zinc-700">{godown.godown_name}</span>
                      <strong className="text-imply-ink">
                        {Number(godown.quantity)} {selectedProduct.unit}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm text-zinc-600">No godown balance has been synced for this product.</p>
              )}
            </div>

            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              Stock is based on the latest successful TallyPrime sync. Orders not yet entered in TallyPrime may not be reflected.
            </div>
            <p className="mt-3 text-sm text-zinc-600">Last successful sync: {formatKolkataDateTime(selectedProduct.inventory_current?.last_successful_sync_at)}</p>
            {role === "admin" ? <p className="mt-2 text-xs text-zinc-500">Mapped Tally item: {selectedProduct.tally_item_name}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg bg-imply-paper p-4">
      <span className="block text-xs font-bold text-zinc-600">{label}</span>
      <strong className="mt-1 block text-2xl font-black text-imply-ink">{value}</strong>
    </article>
  );
}
