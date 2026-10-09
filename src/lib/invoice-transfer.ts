import * as XLSX from "xlsx";
import type { Line } from "./books";
export function exportInvoiceLines(lines: Line[], bill: string) {
  const rows = lines.filter(l => l.item_name.trim()).map(l => ({ "Item Code": l.sku ?? "", "Item Name": l.item_name, Barcode: l.barcode, Unit: l.unit, Quantity: l.quantity, FreeQty: l.free_qty, "Unit Price": l.rate, "Profit %": l.profit_pct, "Sale Price": l.sale_price ?? 0, MRP: l.mrp ?? 0, "Discount Amount": l.discount, "GST %": l.gst_rate, "SL.NO": l.serial_no ?? "" }));
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Invoice"); XLSX.writeFile(book, `${bill || "invoice"}.xlsx`);
}
export async function importInvoiceLines(file: File): Promise<Line[]> {
  const book = XLSX.read(await file.arrayBuffer());
  const first = book.SheetNames[0]; const sheet = first ? book.Sheets[first] : undefined;
  if (!sheet) throw new Error("No invoice sheet found");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  const num = (v: unknown) => Number(v) || 0;
  const lines = rows.filter(r => String(r["Item Name"] ?? "").trim()).map(r => ({ product_id: null, sku: String(r["Item Code"] ?? ""), item_name: String(r["Item Name"]), barcode: String(r["Barcode"] ?? ""), unit: String(r["Unit"] ?? "pcs"), quantity: num(r["Quantity"]), free_qty: num(r["FreeQty"]), rate: num(r["Unit Price"]), profit_pct: num(r["Profit %"]), sale_price: num(r["Sale Price"]), mrp: num(r["MRP"]), discount: num(r["Discount Amount"]), gst_rate: num(r["GST %"]), serial_no: String(r["SL.NO"] ?? "") }));
  if (!lines.length) throw new Error("No invoice items found. Use an exported invoice sheet with Item Name and Quantity columns.");
  if (lines.some(l => l.quantity <= 0 || l.rate < 0 || l.discount < 0 || l.gst_rate < 0 || l.gst_rate > 100)) throw new Error("Check quantities, rates, discounts and GST before importing");
  return lines;
}