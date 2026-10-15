"use client";

import { useActionState, useState } from "react";
import { Link2, Plus, Save } from "lucide-react";
import { mapTallyItemAction } from "@/app/admin/unmapped/actions";
import type { MappingProduct, UnmappedItem } from "@/lib/admin/mapping";

const inputClass = "min-h-11 w-full min-w-0 rounded border border-stone-300 bg-white px-3 text-sm";

export function TallyMappingForm({ item, products }: { item: UnmappedItem; products: MappingProduct[] }) {
  const [mode, setMode] = useState("new");
  const [state, action, pending] = useActionState(mapTallyItemAction, { ok: false, message: "" });
  const [productId, setProductId] = useState("");
  const [query, setQuery] = useState("");
  const selected = products.find((product) => product.id === productId);
  const options = products.filter((product) => product.id === productId || `${product.brand} ${product.product_family} ${product.thickness} ${product.size} ${product.grade} ${product.tally_item_name}`.toLowerCase().includes(query.toLowerCase()));

  if (state.ok) return <p role="status" className="border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-900">{state.message}</p>;

  return (
    <form action={action} className="grid min-w-0 gap-4">
      <input type="hidden" name="tally_item_name" value={item.tally_item_name} />
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        <legend className="sr-only">Mapping mode</legend>
        <div className="flex flex-wrap gap-4 border-b border-stone-200 pb-3">
          <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" name="mode" value="new" checked={mode === "new"} onChange={() => setMode("new")} /><Plus size={16} />New product</label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" name="mode" value="existing" checked={mode === "existing"} onChange={() => setMode("existing")} /><Link2 size={16} />Existing product</label>
        </div>
        {mode === "existing" ? <>
          <label className="grid gap-1 text-sm font-bold">Find product<input className={inputClass} type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="grid gap-1 text-sm font-bold">Product<select className={inputClass} name="product_id" value={productId} onChange={(event) => setProductId(event.target.value)} required>
            <option value="">Select a product</option>
            {options.map((product) => <option key={product.id} value={product.id}>{product.brand} / {product.product_family} / {product.thickness} / {product.size} / {product.grade}{product.active ? "" : " (inactive)"}</option>)}
          </select></label>
          {selected ? <p className="break-words text-sm text-amber-900">Replaces mapping: {selected.tally_item_name}. Current stock is cleared until the next sync. Price and active status are retained.</p> : null}
          {products.length === 0 ? <p className="text-sm text-zinc-600">No catalogue products available.</p> : null}
        </> : <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {([ ["brand", "Brand", 120], ["product_family", "Product family", 160], ["thickness", "Thickness", 80], ["size", "Size", 80], ["grade", "Grade", 80] ] as const).map(([name, label, maxLength]) => <label key={name} className="grid min-w-0 gap-1 text-sm font-bold">{label}<input className={inputClass} name={name} maxLength={maxLength} required /></label>)}
            <label className="grid min-w-0 gap-1 text-sm font-bold">Selling price (INR)<input className={inputClass} name="custom_selling_price" inputMode="decimal" required /></label>
            <label className="grid min-w-0 gap-1 text-sm font-bold">Low-stock threshold<input className={inputClass} type="number" name="low_stock_threshold" min="0" max="2147483647" step="1" defaultValue="10" required /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked />Active catalogue product</label>
        </>}
        {state.message ? <p role="alert" className="text-sm font-bold text-red-700">{state.message}</p> : null}
        <button type="submit" className="flex min-h-11 items-center justify-center gap-2 rounded bg-imply-green px-4 text-sm font-bold text-white disabled:opacity-60" disabled={pending}><Save size={16} />{pending ? "Saving..." : "Save mapping"}</button>
      </fieldset>
    </form>
  );
}
