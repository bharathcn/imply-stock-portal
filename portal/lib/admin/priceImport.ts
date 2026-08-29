import Decimal from "decimal.js";
import Papa from "papaparse";

export const priceImportHeaders = ["brand", "product_family", "thickness", "size", "grade", "custom_selling_price", "low_stock_threshold", "active", "reason"] as const;

export type PriceImportRow = {
  rowNumber: number;
  brand: string;
  product_family: string;
  thickness: string;
  size: string;
  grade: string;
  custom_selling_price: string;
  low_stock_threshold: number;
  active: boolean;
  reason: string | null;
};

export type InvalidImportRow = {
  row: number;
  error: string;
};

export type ProductLookupResult =
  | { status: "missing" }
  | { status: "multiple" }
  | { status: "found"; product: { id: string; custom_selling_price: string; low_stock_threshold: number; active: boolean } };

export type PriceImportStore = {
  findProduct(row: PriceImportRow): Promise<ProductLookupResult>;
  updateProduct(productId: string, changes: { custom_selling_price: string; low_stock_threshold: number; active: boolean }): Promise<void>;
  insertPriceHistory(entry: { product_id: string; old_price: string; new_price: string; changed_by: string; reason: string }): Promise<void>;
};

export type PriceImportResult =
  | { committed: false; validRowCount: number; invalidRows: InvalidImportRow[] }
  | { committed: true; validRowCount: number; updatedRows: number; priceHistoryRows: number };

type RawCsvRow = Record<string, unknown>;

export function parsePriceImportCsv(text: string): { rows: PriceImportRow[]; invalidRows: InvalidImportRow[] } {
  const parsed = Papa.parse<RawCsvRow>(text, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (header) => header.trim(),
    transform: (value) => (typeof value === "string" ? value.trim() : value)
  });

  const invalidRows: InvalidImportRow[] = parsed.errors
    .filter((error) => {
      if (error.row === undefined) return true;
      const rawRow = parsed.data[error.row];
      return !rawRow || !isBlankRow(normalizeRawRow(rawRow));
    })
    .map((error) => ({
      row: error.row === undefined ? 1 : error.row + 2,
      error: error.message
    }));
  const rows: PriceImportRow[] = [];
  const seen = new Set<string>();

  parsed.data.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const normalized = normalizeRawRow(rawRow);
    if (isBlankRow(normalized)) return;

    const requiredMappingFields = ["brand", "product_family", "thickness", "size", "grade"] as const;
    const missingMappingFields = requiredMappingFields.filter((field) => !normalized[field]);
    if (missingMappingFields.length) {
      invalidRows.push({ row: rowNumber, error: `Missing required product mapping fields: ${missingMappingFields.join(", ")}.` });
      return;
    }

    const key = requiredMappingFields.map((field) => normalized[field].toLocaleLowerCase("en-IN")).join("|");
    if (seen.has(key)) {
      invalidRows.push({ row: rowNumber, error: "Duplicate product combination in CSV." });
      return;
    }
    seen.add(key);

    if (!normalized.custom_selling_price) {
      invalidRows.push({ row: rowNumber, error: "custom_selling_price is required." });
      return;
    }

    let price: Decimal;
    try {
      price = new Decimal(normalized.custom_selling_price);
    } catch {
      invalidRows.push({ row: rowNumber, error: "custom_selling_price must be a non-negative decimal." });
      return;
    }
    if (!price.isFinite() || price.isNegative()) {
      invalidRows.push({ row: rowNumber, error: "custom_selling_price must be a non-negative decimal." });
      return;
    }

    const threshold = Number(normalized.low_stock_threshold);
    if (!normalized.low_stock_threshold || !Number.isInteger(threshold) || threshold < 0) {
      invalidRows.push({ row: rowNumber, error: "low_stock_threshold must be a non-negative whole number." });
      return;
    }

    const active = parseBoolean(normalized.active);
    if (active === null) {
      invalidRows.push({ row: rowNumber, error: "active must be true or false." });
      return;
    }

    rows.push({
      rowNumber,
      brand: normalized.brand,
      product_family: normalized.product_family,
      thickness: normalized.thickness,
      size: normalized.size,
      grade: normalized.grade,
      custom_selling_price: price.toFixed(2),
      low_stock_threshold: threshold,
      active,
      reason: normalized.reason || null
    });
  });

  return { rows, invalidRows };
}

export async function runPriceImport(options: { text: string; commit: boolean; changedBy: string; store?: PriceImportStore }): Promise<PriceImportResult> {
  const parsed = parsePriceImportCsv(options.text);
  if (parsed.invalidRows.length) {
    return { committed: false, validRowCount: parsed.rows.length, invalidRows: parsed.invalidRows };
  }
  if (!options.commit) {
    return { committed: false, validRowCount: parsed.rows.length, invalidRows: [] };
  }
  if (!options.store) {
    return { committed: false, validRowCount: parsed.rows.length, invalidRows: [{ row: 1, error: "Database is not configured for commit mode." }] };
  }

  const resolvedRows: Array<{ row: PriceImportRow; product: Extract<ProductLookupResult, { status: "found" }>["product"] }> = [];
  const invalidRows: InvalidImportRow[] = [];

  for (const row of parsed.rows) {
    const lookup = await options.store.findProduct(row);
    if (lookup.status === "missing") {
      invalidRows.push({ row: row.rowNumber, error: "No existing product matches this product combination. Create the product mapping before importing its price." });
    } else if (lookup.status === "multiple") {
      invalidRows.push({ row: row.rowNumber, error: "Multiple products match this combination. Resolve the product mapping data-integrity issue before importing." });
    } else {
      resolvedRows.push({ row, product: lookup.product });
    }
  }

  if (invalidRows.length) {
    return { committed: false, validRowCount: parsed.rows.length, invalidRows };
  }

  let updatedRows = 0;
  let priceHistoryRows = 0;
  for (const { row, product } of resolvedRows) {
    const priceChanged = new Decimal(product.custom_selling_price).toFixed(2) !== row.custom_selling_price;
    const productChanged = priceChanged || product.low_stock_threshold !== row.low_stock_threshold || product.active !== row.active;
    if (!productChanged) continue;

    await options.store.updateProduct(product.id, {
      custom_selling_price: row.custom_selling_price,
      low_stock_threshold: row.low_stock_threshold,
      active: row.active
    });
    updatedRows += 1;

    if (priceChanged) {
      await options.store.insertPriceHistory({
        product_id: product.id,
        old_price: new Decimal(product.custom_selling_price).toFixed(2),
        new_price: row.custom_selling_price,
        changed_by: options.changedBy,
        reason: row.reason || "CSV import"
      });
      priceHistoryRows += 1;
    }
  }

  return { committed: true, validRowCount: parsed.rows.length, updatedRows, priceHistoryRows };
}

function normalizeRawRow(row: RawCsvRow): Record<(typeof priceImportHeaders)[number], string> {
  return Object.fromEntries(priceImportHeaders.map((header) => [header, trimCell(row[header])])) as Record<(typeof priceImportHeaders)[number], string>;
}

function trimCell(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function isBlankRow(row: Record<(typeof priceImportHeaders)[number], string>): boolean {
  return priceImportHeaders.every((header) => row[header] === "");
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.toLocaleLowerCase("en-IN");
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}
