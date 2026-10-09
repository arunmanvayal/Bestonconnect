export type StockRecord = { id: string; name: string; sku?: string | null; barcode?: string | null; quantity: number | string; unit?: string; created_at?: string };
const code = (value: unknown) => String(value ?? "").trim().toLowerCase();
export function duplicateStockIds(products: StockRecord[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const p of products) {
    for (const [kind, value] of [["sku", p.sku], ["barcode", p.barcode]]) {
      if (!code(value)) continue;
      const key = `${kind}:${code(value)}`;
      groups.set(key, [...(groups.get(key) ?? []), p.id]);
    }
  }
  return new Set([...groups.values()].filter(ids => ids.length > 1).flat());
}
export function barcodeSeries(products: StockRecord[]) {
  return [...products].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id))
    .map((p, index) => ({ id: p.id, name: p.name, old_barcode: p.barcode ?? "", barcode: String(index + 1) }));
}
export function filterStock<T extends StockRecord>(products: T[], filter: string, duplicates = duplicateStockIds(products)): T[] {
  return products.filter(p => filter === "zero" ? Number(p.quantity) === 0 : filter === "positive" ? Number(p.quantity) > 0 : filter === "negative" ? Number(p.quantity) < 0 : filter === "duplicates" ? duplicates.has(p.id) : true);
}