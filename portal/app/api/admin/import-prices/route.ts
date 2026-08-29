import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runPriceImport, type PriceImportRow, type PriceImportStore } from "@/lib/admin/priceImport";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const viewer = await requireAdmin();
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  const text = await file.text();
  const commit = formData.get("commit") === "true";
  const store = isSupabaseConfigured() ? await createSupabasePriceImportStore() : undefined;
  const result = await runPriceImport({ text, commit, changedBy: viewer.id, store });
  const status = !result.committed && result.invalidRows.length ? 400 : 200;
  return NextResponse.json(result, { status });
}

async function createSupabasePriceImportStore(): Promise<PriceImportStore> {
  const supabase = await createSupabaseServerClient();
  return {
    async findProduct(row: PriceImportRow) {
      const { data, error } = await supabase
        .from("products")
        .select("id, custom_selling_price, low_stock_threshold, active")
        .match({
          brand: row.brand,
          product_family: row.product_family,
          thickness: row.thickness,
          size: row.size,
          grade: row.grade
        })
        .limit(2);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { status: "missing" };
      if (data.length > 1) return { status: "multiple" };
      return { status: "found", product: data[0] };
    },
    async updateProduct(productId, changes) {
      const { error } = await supabase.from("products").update(changes).eq("id", productId);
      if (error) throw new Error(error.message);
    },
    async insertPriceHistory(entry) {
      const { error } = await supabase.from("price_history").insert(entry);
      if (error) throw new Error(error.message);
    }
  };
}
