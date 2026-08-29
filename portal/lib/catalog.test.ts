import { describe, expect, it } from "vitest";
import { findSelectedProduct, validOptions } from "./catalog";
import { developmentProducts } from "./fixtures";

describe("catalog selection", () => {
  it("filters cascading dropdown options by prior selections", () => {
    expect(validOptions(developmentProducts, { brand: "IMPLY", product_family: "Royal" }, "thickness")).toEqual(["12 mm", "18 mm"]);
    expect(validOptions(developmentProducts, { brand: "IMPLY", product_family: "Bliss" }, "size")).toEqual(["7 x 4 ft"]);
  });

  it("keeps out-of-stock products selectable", () => {
    const product = findSelectedProduct(developmentProducts, {
      brand: "IMPLY",
      product_family: "Royal",
      thickness: "12 mm",
      size: "8 x 4 ft",
      grade: "BWP"
    });
    expect(product?.inventory_current?.total_quantity).toBe("0");
  });
});
