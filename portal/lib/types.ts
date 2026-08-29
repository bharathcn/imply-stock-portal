export type Role = "sales" | "admin";

export type Product = {
  id: string;
  brand: string;
  product_family: string;
  thickness: string;
  size: string;
  grade: string;
  tally_item_name: string;
  unit: string;
  custom_selling_price: string;
  low_stock_threshold: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryCurrent = {
  product_id: string;
  total_quantity: string;
  tally_quantity_raw: string | null;
  last_successful_sync_at: string | null;
  updated_at: string;
};

export type GodownQuantity = {
  product_id: string;
  godown_name: string;
  quantity: string;
  last_successful_sync_at: string | null;
};

export type ProductWithInventory = Product & {
  inventory_current: InventoryCurrent | null;
  inventory_by_godown: GodownQuantity[];
};

export type FreshnessState = "recent" | "stale" | "never";

export type Availability = "In stock" | "Low stock" | "Out of stock" | "Stock unavailable";
