import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const productFields = {
  brand: text(120),
  product_family: text(160),
  thickness: text(80),
  size: text(80),
  grade: text(80),
  custom_selling_price: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a non-negative price with at most two decimal places."),
  low_stock_threshold: z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483647)),
  active: z.boolean()
};

export const mappingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), tally_item_name: text(240), product_id: z.string().uuid() }),
  z.object({ mode: z.literal("new"), tally_item_name: text(240), ...productFields })
]);

export type MappingInput = z.infer<typeof mappingSchema>;
export type MappingState = { ok: boolean; message: string };
export type UnmappedItem = {
  tally_item_name: string;
  last_quantity: string | number | null;
  unit: string | null;
  last_tally_company: string | null;
  last_seen_at: string;
};
export type MappingProduct = {
  id: string;
  brand: string;
  product_family: string;
  thickness: string;
  size: string;
  grade: string;
  tally_item_name: string;
  active: boolean;
};

export function parseMappingForm(form: FormData) {
  return mappingSchema.safeParse({
    ...Object.fromEntries(form),
    active: form.get("active") === "on"
  });
}

export function mappingRpcArgs(input: MappingInput) {
  return {
    item_name: input.tally_item_name,
    target_product_id: input.mode === "existing" ? input.product_id : null,
    new_product: input.mode === "new" ? {
      brand: input.brand,
      product_family: input.product_family,
      thickness: input.thickness,
      size: input.size,
      grade: input.grade,
      custom_selling_price: input.custom_selling_price,
      low_stock_threshold: input.low_stock_threshold,
      active: input.active
    } : null
  };
}
