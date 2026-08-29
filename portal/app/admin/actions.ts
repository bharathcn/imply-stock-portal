"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionState = {
  ok: boolean;
  message: string;
};

export async function updateProductAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const price = String(formData.get("custom_selling_price") ?? "");
  const threshold = Number(formData.get("low_stock_threshold") ?? "");
  const active = formData.get("active") === "on";
  const reason = String(formData.get("reason") ?? "").trim() || null;

  let parsedPrice: Decimal;
  try {
    parsedPrice = new Decimal(price);
  } catch {
    return { ok: false, message: "Enter a valid price and low-stock threshold." };
  }

  if (!id || !parsedPrice.isFinite() || parsedPrice.isNegative() || !Number.isInteger(threshold) || threshold < 0) {
    return { ok: false, message: "Enter a valid price and low-stock threshold." };
  }
  if (!isSupabaseConfigured()) return { ok: true, message: "Development mode: changes are not persisted without Supabase." };

  const supabase = await createSupabaseServerClient();
  const { data: product, error: readError } = await supabase.from("products").select("custom_selling_price").eq("id", id).single();
  if (readError) return { ok: false, message: readError.message };

  const { error } = await supabase
    .from("products")
    .update({ custom_selling_price: price, low_stock_threshold: threshold, active })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  if (product.custom_selling_price !== price) {
    await supabase.from("price_history").insert({
      product_id: id,
      old_price: product.custom_selling_price,
      new_price: price,
      changed_by: viewer.id,
      reason
    });
  }

  revalidatePath("/admin");
  return { ok: true, message: "Product updated." };
}
