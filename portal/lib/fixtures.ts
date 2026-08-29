import type { ProductWithInventory } from "./types";

const syncedAt = "2026-08-20T13:32:00.000Z";

export const developmentProducts: ProductWithInventory[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    brand: "IMPLY",
    product_family: "Royal",
    thickness: "18 mm",
    size: "8 x 4 ft",
    grade: "BWP",
    tally_item_name: "IMPLY ROYAL 18MM 8X4 BWP",
    unit: "sheets",
    custom_selling_price: "2850.00",
    low_stock_threshold: 10,
    active: true,
    created_at: syncedAt,
    updated_at: syncedAt,
    inventory_current: { product_id: "11111111-1111-4111-8111-111111111111", total_quantity: "42", tally_quantity_raw: "42", last_successful_sync_at: syncedAt, updated_at: syncedAt },
    inventory_by_godown: [
      { product_id: "11111111-1111-4111-8111-111111111111", godown_name: "RR Nagar", quantity: "30", last_successful_sync_at: syncedAt },
      { product_id: "11111111-1111-4111-8111-111111111111", godown_name: "Main", quantity: "12", last_successful_sync_at: syncedAt }
    ]
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    brand: "IMPLY",
    product_family: "Royal",
    thickness: "12 mm",
    size: "8 x 4 ft",
    grade: "BWP",
    tally_item_name: "IMPLY ROYAL 12MM 8X4 BWP",
    unit: "sheets",
    custom_selling_price: "2380.00",
    low_stock_threshold: 10,
    active: true,
    created_at: syncedAt,
    updated_at: syncedAt,
    inventory_current: { product_id: "22222222-2222-4222-8222-222222222222", total_quantity: "0", tally_quantity_raw: "0", last_successful_sync_at: syncedAt, updated_at: syncedAt },
    inventory_by_godown: [
      { product_id: "22222222-2222-4222-8222-222222222222", godown_name: "RR Nagar", quantity: "0", last_successful_sync_at: syncedAt },
      { product_id: "22222222-2222-4222-8222-222222222222", godown_name: "Main", quantity: "0", last_successful_sync_at: syncedAt }
    ]
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    brand: "IMPLY",
    product_family: "Plus",
    thickness: "18 mm",
    size: "8 x 4 ft",
    grade: "BWR",
    tally_item_name: "IMPLY PLUS 18MM 8X4 BWR",
    unit: "sheets",
    custom_selling_price: "2490.00",
    low_stock_threshold: 10,
    active: true,
    created_at: syncedAt,
    updated_at: syncedAt,
    inventory_current: { product_id: "33333333-3333-4333-8333-333333333333", total_quantity: "8", tally_quantity_raw: "8", last_successful_sync_at: syncedAt, updated_at: syncedAt },
    inventory_by_godown: [
      { product_id: "33333333-3333-4333-8333-333333333333", godown_name: "RR Nagar", quantity: "5", last_successful_sync_at: syncedAt },
      { product_id: "33333333-3333-4333-8333-333333333333", godown_name: "Main", quantity: "3", last_successful_sync_at: syncedAt }
    ]
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    brand: "IMPLY",
    product_family: "OG",
    thickness: "16 mm",
    size: "8 x 4 ft",
    grade: "BWP",
    tally_item_name: "IMPLY OG 16MM 8X4 BWP",
    unit: "sheets",
    custom_selling_price: "2680.00",
    low_stock_threshold: 10,
    active: true,
    created_at: syncedAt,
    updated_at: syncedAt,
    inventory_current: { product_id: "44444444-4444-4444-8444-444444444444", total_quantity: "21", tally_quantity_raw: "21", last_successful_sync_at: syncedAt, updated_at: syncedAt },
    inventory_by_godown: [
      { product_id: "44444444-4444-4444-8444-444444444444", godown_name: "RR Nagar", quantity: "15", last_successful_sync_at: syncedAt },
      { product_id: "44444444-4444-4444-8444-444444444444", godown_name: "Main", quantity: "6", last_successful_sync_at: syncedAt }
    ]
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    brand: "IMPLY",
    product_family: "Calibrated",
    thickness: "18 mm",
    size: "8 x 4 ft",
    grade: "BWR",
    tally_item_name: "IMPLY CALIBRATED 18MM 8X4 BWR",
    unit: "sheets",
    custom_selling_price: "3120.00",
    low_stock_threshold: 10,
    active: true,
    created_at: syncedAt,
    updated_at: syncedAt,
    inventory_current: { product_id: "55555555-5555-4555-8555-555555555555", total_quantity: "0", tally_quantity_raw: "0", last_successful_sync_at: syncedAt, updated_at: syncedAt },
    inventory_by_godown: [
      { product_id: "55555555-5555-4555-8555-555555555555", godown_name: "RR Nagar", quantity: "0", last_successful_sync_at: syncedAt },
      { product_id: "55555555-5555-4555-8555-555555555555", godown_name: "Main", quantity: "0", last_successful_sync_at: syncedAt }
    ]
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    brand: "IMPLY",
    product_family: "Bliss",
    thickness: "12 mm",
    size: "7 x 4 ft",
    grade: "MR",
    tally_item_name: "IMPLY BLISS 12MM 7X4 MR",
    unit: "sheets",
    custom_selling_price: "1790.00",
    low_stock_threshold: 10,
    active: true,
    created_at: syncedAt,
    updated_at: syncedAt,
    inventory_current: { product_id: "66666666-6666-4666-8666-666666666666", total_quantity: "57", tally_quantity_raw: "57", last_successful_sync_at: syncedAt, updated_at: syncedAt },
    inventory_by_godown: [
      { product_id: "66666666-6666-4666-8666-666666666666", godown_name: "RR Nagar", quantity: "37", last_successful_sync_at: syncedAt },
      { product_id: "66666666-6666-4666-8666-666666666666", godown_name: "Main", quantity: "20", last_successful_sync_at: syncedAt }
    ]
  }
];
