import { describe, expect, it } from "vitest";
import { mappingRpcArgs, mappingSchema, parseMappingForm } from "./mapping";

const newProduct = {
  mode: "new", tally_item_name: "PLY 18MM", brand: "IMPLY", product_family: "Royal",
  thickness: "18 mm", size: "8 x 4 ft", grade: "BWP", custom_selling_price: "2850.00",
  low_stock_threshold: "10", active: true
};

describe("Tally mapping validation", () => {
  it("validates a new priced product and trims fields", () => {
    const result = mappingSchema.parse({ ...newProduct, brand: " IMPLY " });
    expect(mappingRpcArgs(result)).toEqual({ item_name: "PLY 18MM", target_product_id: null,
      new_product: { brand: "IMPLY", product_family: "Royal", thickness: "18 mm", size: "8 x 4 ft", grade: "BWP", custom_selling_price: "2850.00", low_stock_threshold: 10, active: true } });
  });

  it.each(["", "-1", "NaN", "Infinity", "1e3", "12.345", "10000000000"])("rejects invalid price %j", (price) => {
    expect(mappingSchema.safeParse({ ...newProduct, custom_selling_price: price }).success).toBe(false);
  });

  it.each(["", "-1", "1.2", "2147483648"])("rejects invalid threshold %j", (threshold) => {
    expect(mappingSchema.safeParse({ ...newProduct, low_stock_threshold: threshold }).success).toBe(false);
  });

  it("accepts zero price and zero threshold", () => {
    expect(mappingSchema.safeParse({ ...newProduct, custom_selling_price: "0", low_stock_threshold: "0" }).success).toBe(true);
  });

  it("existing mapping sends only identity, never client stock or price", () => {
    const parsed = mappingSchema.parse({ mode: "existing", tally_item_name: "PLY", product_id: "11111111-1111-4111-8111-111111111111", last_quantity: 999, custom_selling_price: "0" });
    expect(mappingRpcArgs(parsed)).toEqual({ item_name: "PLY", target_product_id: "11111111-1111-4111-8111-111111111111", new_product: null });
  });

  it("rejects missing product identity or blank attributes", () => {
    expect(mappingSchema.safeParse({ mode: "existing", tally_item_name: "PLY", product_id: "" }).success).toBe(false);
    expect(mappingSchema.safeParse({ ...newProduct, grade: " " }).success).toBe(false);
  });

  it("reads checkbox state without trusting an arbitrary truthy value", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(newProduct)) if (key !== "active") form.set(key, String(value));
    const result = parseMappingForm(form);
    expect(result.success && result.data.mode === "new" && result.data.active).toBe(false);
    form.set("active", "on");
    const active = parseMappingForm(form);
    expect(active.success && active.data.mode === "new" && active.data.active).toBe(true);
  });
});
