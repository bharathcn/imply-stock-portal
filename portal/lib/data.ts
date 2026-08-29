import { developmentProducts } from "./fixtures";
import { isSupabaseConfigured } from "./env";
import { createSupabaseServerClient } from "./supabase/server";
import type { ProductWithInventory } from "./types";

export async function getActiveProducts(): Promise<ProductWithInventory[]> {
  if (!isSupabaseConfigured()) return developmentProducts;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, inventory_current(*), inventory_by_godown(*)")
    .eq("active", true)
    .order("brand")
    .order("product_family");
  if (error) throw new Error(error.message);
  return data as ProductWithInventory[];
}

export async function getAdminProducts(): Promise<ProductWithInventory[]> {
  if (!isSupabaseConfigured()) return developmentProducts;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, inventory_current(*), inventory_by_godown(*)")
    .order("brand")
    .order("product_family");
  if (error) throw new Error(error.message);
  return data as ProductWithInventory[];
}
