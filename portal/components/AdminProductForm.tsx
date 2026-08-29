"use client";

import { useActionState } from "react";
import { updateProductAction, type ActionState } from "@/app/admin/actions";
import type { ProductWithInventory } from "@/lib/types";

const initialState: ActionState = { ok: true, message: "" };

export function AdminProductForm({ product }: { product: ProductWithInventory }) {
  const [state, action, pending] = useActionState(updateProductAction, initialState);
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
      <input type="hidden" name="id" value={product.id} />
      <div>
        <p className="text-xs font-black tracking-widest text-amber-800">EDIT PRODUCT</p>
        <h2 className="mt-1 text-xl font-black text-imply-ink">
          {product.brand} {product.product_family}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {product.thickness} / {product.size} / {product.grade}
        </p>
      </div>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Custom selling price
        <input className="h-12 rounded-lg border border-stone-300 px-3" name="custom_selling_price" inputMode="decimal" defaultValue={product.custom_selling_price} required />
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Low-stock threshold
        <input className="h-12 rounded-lg border border-stone-300 px-3" name="low_stock_threshold" inputMode="numeric" defaultValue={product.low_stock_threshold} required />
      </label>
      <label className="flex items-center gap-3 text-sm font-bold text-zinc-700">
        <input className="h-5 w-5" type="checkbox" name="active" defaultChecked={product.active} />
        Active catalogue product
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Reason
        <textarea className="min-h-24 rounded-lg border border-stone-300 p-3" name="reason" placeholder="Optional price-change reason" />
      </label>
      <p className="text-xs text-zinc-500">Mapped Tally item: {product.tally_item_name}</p>
      {state.message ? <p className={state.ok ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-red-700"}>{state.message}</p> : null}
      <button className="h-12 rounded-lg bg-imply-green px-4 font-black text-white disabled:opacity-60" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
