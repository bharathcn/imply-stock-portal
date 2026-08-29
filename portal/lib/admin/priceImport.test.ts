import { describe, expect, it, vi } from "vitest";
import { runPriceImport, type PriceImportStore, type ProductLookupResult } from "./priceImport";

const header = "brand,product_family,thickness,size,grade,custom_selling_price,low_stock_threshold,active,reason";

function csv(row: string) {
  return `${header}\n${row}\n`;
}

function createStore(product?: { id: string; custom_selling_price: string; low_stock_threshold: number; active: boolean }, status: "found" | "missing" | "multiple" = product ? "found" : "missing") {
  const store: PriceImportStore = {
    findProduct: vi.fn(async (): Promise<ProductLookupResult> => {
      if (status === "multiple") return { status: "multiple" };
      if (status === "missing" || !product) return { status: "missing" };
      return { status: "found", product };
    }),
    updateProduct: vi.fn(async () => undefined),
    insertPriceHistory: vi.fn(async () => undefined)
  };
  return store;
}

describe("price CSV import", () => {
  it("accepts one valid new product row during validation", async () => {
    const store = createStore();
    const result = await runPriceImport({
      text: csv(" IMPLY , TEST ROYAL , 18 mm , 8 × 4 ft , BWP , 2850.00 , 10 , true , Initial Supabase integration test "),
      commit: false,
      changedBy: "admin-user",
      store
    });

    expect(result).toEqual({ committed: false, validRowCount: 1, invalidRows: [] });
    expect(store.findProduct).not.toHaveBeenCalled();
    expect(store.updateProduct).not.toHaveBeenCalled();
  });

  it("ignores a trailing blank row", async () => {
    const result = await runPriceImport({
      text: `${header}\nIMPLY,TEST ROYAL,18 mm,8 × 4 ft,BWP,2850.00,10,true,Initial Supabase integration test\n,,,,,,,,\n`,
      commit: false,
      changedBy: "admin-user"
    });

    expect(result).toEqual({ committed: false, validRowCount: 1, invalidRows: [] });
  });

  it("updates an existing product and writes price history on commit", async () => {
    const store = createStore({ id: "product-1", custom_selling_price: "2800.00", low_stock_threshold: 5, active: true });
    const result = await runPriceImport({
      text: csv("IMPLY,Royal,18 mm,8 x 4 ft,BWP,2850.00,10,true,Price correction"),
      commit: true,
      changedBy: "admin-user",
      store
    });

    expect(result).toEqual({ committed: true, validRowCount: 1, updatedRows: 1, priceHistoryRows: 1 });
    expect(store.updateProduct).toHaveBeenCalledWith("product-1", {
      custom_selling_price: "2850.00",
      low_stock_threshold: 10,
      active: true
    });
    expect(store.insertPriceHistory).toHaveBeenCalledWith({
      product_id: "product-1",
      old_price: "2800.00",
      new_price: "2850.00",
      changed_by: "admin-user",
      reason: "Price correction"
    });
  });

  it("returns a clear validation error for missing price", async () => {
    const result = await runPriceImport({
      text: csv("IMPLY,Royal,18 mm,8 x 4 ft,BWP,,10,true,Missing price"),
      commit: false,
      changedBy: "admin-user"
    });

    expect(result).toEqual({ committed: false, validRowCount: 0, invalidRows: [{ row: 2, error: "custom_selling_price is required." }] });
  });

  it("returns a clear validation error for invalid decimal price", async () => {
    const result = await runPriceImport({
      text: csv("IMPLY,Royal,18 mm,8 x 4 ft,BWP,not-a-price,10,true,Bad price"),
      commit: false,
      changedBy: "admin-user"
    });

    expect(result).toEqual({ committed: false, validRowCount: 0, invalidRows: [{ row: 2, error: "custom_selling_price must be a non-negative decimal." }] });
  });

  it("rejects duplicate product combinations", async () => {
    const result = await runPriceImport({
      text: `${header}\nIMPLY,Royal,18 mm,8 x 4 ft,BWP,2850.00,10,true,First\nIMPLY,Royal,18 mm,8 x 4 ft,BWP,2900.00,10,true,Duplicate\n`,
      commit: false,
      changedBy: "admin-user"
    });

    expect(result).toEqual({ committed: false, validRowCount: 1, invalidRows: [{ row: 3, error: "Duplicate product combination in CSV." }] });
  });

  it("does not make database changes in validation-only mode", async () => {
    const store = createStore({ id: "product-1", custom_selling_price: "2800.00", low_stock_threshold: 5, active: true });
    await runPriceImport({
      text: csv("IMPLY,Royal,18 mm,8 x 4 ft,BWP,2850.00,10,true,Validate only"),
      commit: false,
      changedBy: "admin-user",
      store
    });

    expect(store.findProduct).not.toHaveBeenCalled();
    expect(store.updateProduct).not.toHaveBeenCalled();
    expect(store.insertPriceHistory).not.toHaveBeenCalled();
  });

  it("treats a missing product during commit as a row-level validation error", async () => {
    const store = createStore();
    const result = await runPriceImport({
      text: csv("IMPLY,TEST ROYAL,18 mm,8 × 4 ft,BWP,2850.00,10,true,Needs mapping"),
      commit: true,
      changedBy: "admin-user",
      store
    });

    expect(result).toEqual({
      committed: false,
      validRowCount: 1,
      invalidRows: [{ row: 2, error: "No existing product matches this product combination. Create the product mapping before importing its price." }]
    });
    expect(store.updateProduct).not.toHaveBeenCalled();
  });
});
