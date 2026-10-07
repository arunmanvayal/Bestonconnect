import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { fetchBalances } from "@/lib/books";

export type Dataset = "customers" | "vendors" | "ledgers" | "products";

export const PARTY_HEADERS = ["Ledger Code", "Ledger Name", "Address", "Contact No", "Phone No", "Area", "TIN No", "Email", "Remarks", "Discount", "OS Amount"];
export const PRODUCT_HEADERS = ["Item Code", "Item Name", "HSNCODE", "Barcode", "Category", "Manufacturer", "ROL", "Rack", "Unit", "Alt Unit", "Conv.Factor", "PR.Rate", "SL Rate", "MRP", "Quantity", "CGST %", "SGST %", "IGST %", "PR TaxIncl", "SL TaxIncl", "Expiry", "Expiry Date"];
export const LEDGER_HEADERS = ["Ledger Code", "Ledger Name", "Group", "Opening Balance", "Debit", "Credit", "Closing Balance"];

export const DATASET_LABEL: Record<Dataset, string> = { customers: "Customers", vendors: "Vendors", ledgers: "Ledgers", products: "Product" };
const FILE_NAME: Record<Dataset, string> = { customers: "CUSTOMER", vendors: "VENDORS", ledgers: "LEDGERS", products: "PRODUCT" };

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown) => { const n = Number(str(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const bool = (v: unknown) => v === true || /^(true|yes|y|1)$/i.test(str(v));
const fix = (n: number) => Number(n || 0).toFixed(2);
const pct = (n: number) => Number(n || 0).toFixed(1);

/** Reads every row of a table, past the 1000-row page limit. */
export async function fetchAll(sb: SupabaseClient, table: string, filter?: (q: any) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select("*").order("name").range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

function download(rows: unknown[][], dataset: Dataset) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = (rows[0] as string[]).map((h) => ({ wch: Math.max(10, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${FILE_NAME[dataset]}.xlsx`);
}

export function downloadTemplate(dataset: Dataset) {
  download([dataset === "products" ? PRODUCT_HEADERS : dataset === "ledgers" ? LEDGER_HEADERS : PARTY_HEADERS], dataset);
}

export async function exportDataset(sb: SupabaseClient, dataset: Dataset) {
  if (dataset === "products") {
    const items = await fetchAll(sb, "products");
    download([PRODUCT_HEADERS, ...items.map((p) => {
      const g = Number(p.gst_rate ?? 0);
      return [p.sku || p.name, p.name, p.hsn ?? "", p.barcode ?? "", p.category ?? "", p.manufacturer || "NONE", String(p.reorder_level ?? 0), p.rack ?? "", p.unit ?? "", p.alt_unit ?? "", String(p.conv_factor ?? 1),
        fix(p.cost_price), fix(p.unit_price), fix(p.mrp), Number(p.quantity ?? 0), pct(g / 2), pct(g / 2), "0.0", !!p.purchase_tax_incl, !!p.sale_tax_incl, !!p.expiry_date, p.expiry_date || "NA"];
    })], dataset);
    return items.length;
  }
  if (dataset === "ledgers") {
    const accs = await fetchBalances(sb);
    download([LEDGER_HEADERS, ...accs.map((a: any) => [a.code, a.name, a.type, fix(a.opening_balance), fix(a.debit_total), fix(a.credit_total), fix(a.balance)])], dataset);
    return accs.length;
  }
  const supplier = dataset === "vendors";
  const parties = (await fetchAll(sb, "customers")).filter((c) => (c.party_type === "supplier") === supplier);
  download([PARTY_HEADERS, ...parties.map((c) => [c.code || c.name, c.name, c.address ?? "", c.contact_no ?? "", c.phone ?? "", c.area || "NONE", c.gstin ?? "", c.email ?? "", c.notes ?? "", pct(c.discount), c.opening_balance ? fix(c.opening_balance) : null])], dataset);
  return parties.length;
}

/** Parses a spreadsheet into header-keyed rows, dropping empty lines. */
export async function readSheet(file: File) {
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  const clean = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v])))
    .filter((r) => Object.values(r).some((v) => str(v) !== ""));
  const headers = clean[0] ? Object.keys(clean[0]) : [];
  return { rows: clean, headers };
}

export function detectDataset(headers: string[]): Dataset | null {
  if (headers.includes("Item Name")) return "products";
  if (headers.includes("Ledger Name")) return "customers";
  return null;
}

type Progress = (done: number, total: number) => void;
export type ImportResult = { inserted: number; updated: number; skipped: number };

async function runChunks<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>, onStep: (n: number) => void) {
  for (let i = 0; i < items.length; i += size) { const chunk = items.slice(i, i + size); await fn(chunk); onStep(chunk.length); }
}

export async function importRows(sb: SupabaseClient, dataset: Dataset, rows: Record<string, unknown>[], updateExisting: boolean, onProgress: Progress): Promise<ImportResult> {
  const res: ImportResult = { inserted: 0, updated: 0, skipped: 0 };
  let done = 0;
  const step = (n: number) => { done += n; onProgress(done, rows.length); };

  if (dataset === "products") {
    const existing = await fetchAll(sb, "products");
    const byBarcode = new Map<string, any>(), byCode = new Map<string, any>();
    for (const p of existing) {
      if (p.barcode) byBarcode.set(str(p.barcode).toLowerCase(), p);
      else byCode.set(`${str(p.sku)}|${str(p.name)}`.toLowerCase(), p);
    }
    const inserts: any[] = [], updates: Array<{ id: string; rec: any }> = [];
    for (const r of rows) {
      const name = str(r["Item Name"]) || str(r["Item Code"]);
      if (!name) { res.skipped++; step(1); continue; }
      const igst = num(r["IGST %"]);
      const rec = {
        sku: str(r["Item Code"]) || name, name, hsn: str(r["HSNCODE"]), barcode: str(r["Barcode"]), category: str(r["Category"]),
        manufacturer: str(r["Manufacturer"]), reorder_level: num(r["ROL"]), rack: str(r["Rack"]), unit: str(r["Unit"]) || "pcs",
        alt_unit: str(r["Alt Unit"]), conv_factor: num(r["Conv.Factor"]) || 1, cost_price: num(r["PR.Rate"]), unit_price: num(r["SL Rate"]),
        mrp: num(r["MRP"]), quantity: num(r["Quantity"]), gst_rate: igst || num(r["CGST %"]) + num(r["SGST %"]),
        purchase_tax_incl: bool(r["PR TaxIncl"]), sale_tax_incl: bool(r["SL TaxIncl"]),
        expiry_date: /^(na|)$/i.test(str(r["Expiry Date"])) ? "" : str(r["Expiry Date"]),
      };
      const match = rec.barcode ? byBarcode.get(rec.barcode.toLowerCase()) : byCode.get(`${rec.sku}|${name}`.toLowerCase());
      if (match) { if (updateExisting) updates.push({ id: match.id, rec }); else { res.skipped++; step(1); } }
      else {
        inserts.push(rec);
        if (rec.barcode) byBarcode.set(rec.barcode.toLowerCase(), rec); else byCode.set(`${rec.sku}|${name}`.toLowerCase(), rec);
      }
    }
    await runChunks(inserts, 500, async (chunk) => {
      const { data, error } = await sb.from("products").insert(chunk).select("id, quantity");
      if (error) throw error;
      const moves = (data ?? []).filter((p: any) => Number(p.quantity) > 0).map((p: any) => ({ product_id: p.id, type: "in", quantity: Number(p.quantity), note: "Opening stock (Excel import)" }));
      if (moves.length) await sb.from("stock_movements").insert(moves);
      res.inserted += chunk.length;
    }, step);
    await runChunks(updates, 10, async (chunk) => {
      const results = await Promise.all(chunk.map(({ id, rec }) => sb.from("products").update(rec).eq("id", id)));
      const err = results.find((x) => x.error)?.error; if (err) throw err;
      res.updated += chunk.length;
    }, step);
    return res;
  }

  const partyType = dataset === "vendors" ? "supplier" : "customer";
  const existing = (await fetchAll(sb, "customers")).filter((c) => (c.party_type ?? "customer") === partyType);
  const byName = new Map(existing.map((c) => [str(c.name).toLowerCase(), c]));
  const inserts: any[] = [], updates: Array<{ id: string; rec: any }> = [];
  for (const r of rows) {
    const name = str(r["Ledger Name"]) || str(r["Ledger Code"]);
    if (!name) { res.skipped++; step(1); continue; }
    const area = str(r["Area"]);
    const rec = {
      code: str(r["Ledger Code"]) || name, name, address: str(r["Address"]), contact_no: str(r["Contact No"]),
      phone: str(r["Phone No"]) || str(r["Contact No"]), area: /^none$/i.test(area) ? "" : area, gstin: str(r["TIN No"]),
      email: str(r["Email"]), notes: str(r["Remarks"]), discount: num(r["Discount"]), opening_balance: num(r["OS Amount"]), party_type: partyType,
    };
    const match = byName.get(name.toLowerCase());
    if (match) { if (updateExisting) updates.push({ id: match.id, rec }); else { res.skipped++; step(1); } }
    else { inserts.push(rec); byName.set(name.toLowerCase(), rec); }
  }
  await runChunks(inserts, 500, async (chunk) => {
    const { error } = await sb.from("customers").insert(chunk); if (error) throw error;
    res.inserted += chunk.length;
  }, step);
  await runChunks(updates, 10, async (chunk) => {
    const results = await Promise.all(chunk.map(({ id, rec }) => sb.from("customers").update(rec).eq("id", id)));
    const err = results.find((x) => x.error)?.error; if (err) throw err;
    res.updated += chunk.length;
  }, step);
  return res;
}
