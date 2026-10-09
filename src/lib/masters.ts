import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/data-transfer";

export const MASTER_OPTIONS = [
  ["category", "Category"], ["product", "Product"], ["manufacturer", "Manufacturer"],
  ["customer", "Customer"], ["supplier", "Supplier"], ["account_group", "Account Group"],
  ["ledger", "Ledger"], ["area", "Area"], ["employee", "Employee"],
  ["cost_centre", "Cost Centre"], ["store_location", "Store Location"], ["agent", "Agent"],
] as const;
export type MasterKind = typeof MASTER_OPTIONS[number][0] | "product_group";
export type MasterRecord = { id: string; kind: MasterKind; name: string; code: string; details: Record<string, string>; active: boolean };
export function useMasters() {
  const sb = useSupabase();
  return useQuery({ queryKey: ["masters"], enabled: !!sb, queryFn: async () => {
    if (!sb) throw new Error("Connection unavailable");
    return await fetchAll(sb, "master_records") as MasterRecord[];
  }});
}
export function masterNames(records: MasterRecord[], kind: MasterKind, current = "") {
  return [...new Set([current, ...records.filter(r => r.kind === kind && r.active).map(r => r.name)].filter(Boolean))].sort((a,b) => a.localeCompare(b));
}
export const EMPTY_PRODUCT = {
  sku: "", name: "", product_group: "GENERAL", manufacturer: "", category: "", barcode: "", hsn: "",
  cgst_rate: "9", sgst_rate: "9", igst_rate: "18", reorder_level: "0", cost_price: "0", unit_price: "0", mrp: "0",
  unit: "pcs", alt_unit: "", conv_factor: "1", remarks: "", store_location: "MAIN", quantity: "0",
  sale_tax_incl: false, purchase_tax_incl: false, deactivated: false,
};
export type ProductForm = typeof EMPTY_PRODUCT;
export function productForm(record?: Record<string, any> | null): ProductForm {
  if (!record) return { ...EMPTY_PRODUCT };
  const result = { ...EMPTY_PRODUCT };
  for (const key of Object.keys(result) as Array<keyof ProductForm>) {
    if (typeof result[key] === "boolean") (result as Record<string, unknown>)[key] = !!record[key];
    else (result as Record<string, unknown>)[key] = String(record[key] ?? result[key]);
  }
  result.cgst_rate = String(record['cgst_rate'] ?? Number(record['gst_rate'] ?? 18)/2);
  result.sgst_rate = String(record['sgst_rate'] ?? Number(record['gst_rate'] ?? 18)/2);
  result.igst_rate = String(record['igst_rate'] ?? record['gst_rate'] ?? 18);
  return result;
}
export function productPayload(form: ProductForm) {
  if (!form.name.trim() || !form.unit.trim()) throw new Error("Product name and main unit are required");
  const output: Record<string, string | number | boolean> = { ...form, name: form.name.trim(), sku: form.sku.trim(), barcode: form.barcode.trim() };
  for (const key of ["cgst_rate", "sgst_rate", "igst_rate", "reorder_level", "cost_price", "unit_price", "mrp", "conv_factor", "quantity"] as const) {
    const n = Number(form[key]);
    if (!Number.isFinite(n) || (key !== "quantity" && n < 0) || (key === "conv_factor" && n <= 0) || (key.endsWith("gst_rate") && n > 100)) throw new Error(`Invalid ${key.replaceAll("_", " ")}`);
    output[key] = n;
  }
  output['gst_rate'] = Number(form.cgst_rate) + Number(form.sgst_rate);
  return output;
}
export function productInvoiceDefaults(p: Record<string, any>, kind: "sale" | "purchase", taxType: string) {
  if (p['deactivated']) throw new Error("This product is deactivated");
  const gst = taxType === "none" ? 0 : taxType === "igst" ? Number(p['igst_rate'] ?? p['gst_rate'] ?? 18) : Number(p['cgst_rate'] ?? Number(p['gst_rate'] ?? 18)/2) + Number(p['sgst_rate'] ?? Number(p['gst_rate'] ?? 18)/2);
  const inclusive = kind === "sale" ? p['sale_tax_incl'] : p['purchase_tax_incl'];
  const price = Number(kind === "sale" ? p['unit_price'] : p['cost_price'] ?? p['unit_price']) || 0;
  return { rate: inclusive ? price / (1 + gst / 100) : price, gst_rate: gst, unit: p['unit'] || "pcs", sku: p['sku'] ?? "", mrp: Number(p['mrp']) || 0, sale_price: Number(p['unit_price']) || 0 };
}