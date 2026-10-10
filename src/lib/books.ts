import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSearchRecords } from "./search-data";
import type { EntryDetails } from "./invoice-entry";

export type Kind = "sale" | "purchase";

export type Line = {
  product_id: string | null;
  item_name: string;
  barcode: string;
  unit: string;
  quantity: number;
  free_qty: number;
  rate: number;
  discount: number;
  gst_rate: number;
  profit_pct: number;
  sku?: string;
  serial_no?: string;
  mrp?: number;
  sale_price?: number;
};

export type Header = {
  bill_no: string;
  bill_date: string;
  party_name: string;
  contact: string;
  payment_mode: string;
  tax_type: string;
  bill_type: string;
  salesman: string;
  ref_no: string;
  bill_discount: number;
  other_exp: number;
  freight: number;
  cash_disc: number;
  remarks: string;
  shipping_address: string;
  billing_address: string;
  entry_details?: EntryDetails;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineCalc(l: Line) {
  const gross = l.quantity * l.rate;
  const taxable = Math.max(0, gross - l.discount);
  const tax = (taxable * l.gst_rate) / 100;
  return { gross, taxable, tax, amount: taxable + tax };
}

export function allocatedInvoiceLines(lines: Line[], h: Header) {
  const base = lines.reduce((sum, l) => sum + lineCalc(l).taxable, 0);
  const ratio = base > 0 ? Math.max(0, base - h.bill_discount) / base : 1;
  return lines.map(l => {
    const taxable = r2(lineCalc(l).taxable * ratio);
    const tax = h.tax_type === "none" ? 0 : r2(taxable * l.gst_rate / 100);
    return { ...l, taxable, tax, amount: r2(taxable + tax) };
  });
}

export function totals(lines: Line[], h: Header) {
  const allocated = allocatedInvoiceLines(lines, h);
  const gross = lines.reduce((sum, l) => sum + lineCalc(l).gross, 0);
  const discount = lines.reduce((sum, l) => sum + l.discount, h.bill_discount);
  const taxable = r2(allocated.reduce((sum, l) => sum + l.taxable, 0));
  const tax = r2(allocated.reduce((sum, l) => sum + l.tax, 0));
  const cgst = h.tax_type === "gst" ? r2(tax / 2) : 0;
  const sgst = h.tax_type === "gst" ? r2(tax - cgst) : 0;
  const igst = h.tax_type === "igst" ? tax : 0;
  const totalValue = r2(taxable + tax);
  const beforeRound = totalValue + h.other_exp + h.freight - h.cash_disc;
  const net = Math.round(beforeRound);
  return { gross: r2(gross), discount: r2(discount), taxable, cgst, sgst, igst, total_tax: tax,
    total_value: totalValue, round_off: r2(net - beforeRound), net_total: net,
    total_qty: lines.reduce((sum, l) => sum + l.quantity + l.free_qty, 0) };
}

/** Keep the same request for retries of identical payloads, including uncertain network failures. */
const saveRequests = new WeakMap<SupabaseClient, Map<string, string>>();
async function atomicSave<T>(sb: SupabaseClient, operation: string, payload: Record<string, unknown>): Promise<T> {
  let requests = saveRequests.get(sb);
  if (!requests) { requests = new Map(); saveRequests.set(sb, requests); }
  const fingerprint = JSON.stringify([operation, payload]);
  const request = requests.get(fingerprint) ?? crypto.randomUUID();
  requests.set(fingerprint, request);
  const { data, error } = await sb.rpc(operation, { ...payload, _request_key: request });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") throw new Error("Run the Financial transactions update on Setup before saving. No partial-write fallback was attempted; your entries remain on screen.");
    throw new Error(error.message || "Save was not confirmed. Your entries remain on screen; retry the same save.");
  }
  if (data === null || data === undefined) throw new Error("Save was not confirmed. Retry the same save before creating another entry.");
  requests.delete(fingerprint);
  return data as T;
}

/** Invoice, items, stock, party and ledger commit together on the database. */
export async function postInvoice(sb: SupabaseClient, kind: Kind, h: Header, rawLines: Line[]) {
  const lines = rawLines.filter(l => l.item_name.trim() && l.quantity > 0);
  if (!lines.length) throw new Error("Add at least one item with quantity");
  return atomicSave<string>(sb, "post_financial_invoice", { _kind: kind, _header: h, _lines: lines, _invoice_id: null });
}

/** Preserve the saved bill identity with the same calculator as new invoices. */
export async function updateSalesInvoice(sb: SupabaseClient, invoiceId: string, h: Header, rawLines: Line[]) {
  const lines = rawLines.filter(l => l.item_name.trim() && l.quantity > 0);
  if (!lines.length) throw new Error("Add at least one item with quantity");
  return atomicSave<string>(sb, "post_financial_invoice", { _kind: "sale", _header: h, _lines: lines, _invoice_id: invoiceId });
}

/** Live account balances = opening balance + ledger activity. */
export async function fetchBalances(sb: SupabaseClient) {
  const [accounts, lines] = await Promise.all([
    fetchSearchRecords(sb, "accounts", "code"),
    fetchSearchRecords(sb, "journal_lines", "id"),
  ]);
  return (accounts ?? []).map((a: any) => {
    let dr = 0, cr = 0;
    for (const l of lines ?? []) if (l.account_id === a.id) { dr += Number(l.debit); cr += Number(l.credit); }
    const debitNature = a.type === "asset" || a.type === "expense";
    const balance = Number(a.opening_balance ?? 0) + (debitNature ? dr - cr : cr - dr);
    return { ...a, debit_total: dr, credit_total: cr, balance };
  });
}

export const INVOICE_QUERY_KEYS = [
  ["invoices"], ["products"], ["accounts"], ["balances"], ["dashboard"], ["journal"], ["journal_entries"], ["customers"], ["ledger"], ["payments"], ["outstanding"], ["returns"], ["reports"], ["invoice-print"], ["customer-detail"], ["online-catalog"], ["online-admin-products"], ["invoice-next-number"],
];

export type PayKind = "receipt" | "payment";

/** Records a customer receipt or supplier payment and posts it to the ledger. */
export async function postPayment(sb: SupabaseClient, p: {
  kind: PayKind; voucher_no: string; pay_date: string; party_id: string | null; party_name: string;
  amount: number; mode: string; reference: string; notes: string;
}) {
  if (!p.party_name.trim() || !p.party_id) throw new Error("Select a party");
  if (!Number.isFinite(p.amount) || !(p.amount > 0)) throw new Error("Enter an amount");
  return atomicSave<string>(sb, "post_financial_payment", { _payment: p });
}

/** Outstanding per party: credit bills minus receipts/payments. */
export async function fetchOutstanding(sb: SupabaseClient) {
  const [inv, pays, rets, parties] = await Promise.all([
    fetchSearchRecords(sb, "invoices", "bill_date"),
    fetchSearchRecords(sb, "payments", "pay_date").then(rows => rows.reverse()),
    fetchSearchRecords(sb, "sales_returns", "id"),
    fetchSearchRecords(sb, "customers", "name"),
  ]);
  const map = new Map<string, { key: string; party_id: string | null; party_name: string; side: "customer" | "supplier"; billed: number; settled: number; balance: number }>();
  const key = (side: string, id: string | null, name: string) => `${side}:${id ?? name.toLowerCase()}`;
  for (const c of (parties ?? []) as any[]) {
    const ob = Number(c.opening_balance ?? 0);
    if (!ob) continue;
    const side = c.party_type === "supplier" ? "supplier" : "customer";
    const k = key(side, c.id, c.name);
    map.set(k, { key: k, party_id: c.id, party_name: c.name, side, billed: ob, settled: 0, balance: 0 });
  }
  for (const i of inv ?? []) {
    if (i.payment_mode !== "credit" || !i.party_name) continue;
    const side = i.kind === "sale" ? "customer" : "supplier";
    const k = key(side, i.party_id, i.party_name);
    const r = map.get(k) ?? { key: k, party_id: i.party_id, party_name: i.party_name, side, billed: 0, settled: 0, balance: 0 };
    r.billed += Number(i.net_total); map.set(k, r);
  }
  for (const p of pays ?? []) {
    const side = p.kind === "receipt" ? "customer" : "supplier";
    const k = key(side, p.party_id, p.party_name);
    const r = map.get(k) ?? { key: k, party_id: p.party_id, party_name: p.party_name, side, billed: 0, settled: 0, balance: 0 };
    r.settled += Number(p.amount); map.set(k, r);
  }
  for (const rt of rets ?? []) {
    if (rt.refund_mode !== "credit" || !rt.party_name) continue;
    const k = key("customer", rt.party_id, rt.party_name);
    const r = map.get(k) ?? { key: k, party_id: rt.party_id, party_name: rt.party_name, side: "customer" as const, billed: 0, settled: 0, balance: 0 };
    r.billed -= Number(rt.amount); map.set(k, r);
  }
  const rows = [...map.values()].map((r) => ({ ...r, billed: r2(r.billed), balance: r2(r.billed - r.settled) }));
  return { rows, payments: pays ?? [], invoices: (inv ?? []).filter((i) => i.payment_mode === "credit") };
}

export type ReturnLine = { invoice_item_id: string; product_id: string | null; item_name: string; sold: number; returned: number; qty: number; rate: number; gst_rate: number; unitTaxable: number; unitTax: number };

/** Loads a sale invoice's items with already-returned quantities. */
export async function loadReturnable(sb: SupabaseClient, invoiceId: string): Promise<ReturnLine[]> {
  const [{ data: items, error }, { data: prev, error: previousError }] = await Promise.all([
    sb.from("invoice_items").select("*").eq("invoice_id", invoiceId),
    sb.from("sales_return_items").select("invoice_item_id, quantity, sales_returns!inner(invoice_id)").eq("sales_returns.invoice_id", invoiceId),
  ]);
  if (error) throw error;
  if (previousError) throw previousError;
  return (items ?? []).map((it: any) => {
    const sold = Number(it.quantity);
    const returned = (prev ?? []).filter((p: any) => p.invoice_item_id === it.id).reduce((a: number, p: any) => a + Number(p.quantity), 0);
    return {
      invoice_item_id: it.id, product_id: it.product_id, item_name: it.item_name, sold, returned, qty: 0,
      rate: Number(it.rate), gst_rate: Number(it.gst_rate),
      unitTaxable: sold ? Number(it.taxable) / sold : 0, unitTax: sold ? Number(it.tax) / sold : 0,
    };
  });
}

/** Posts a partial/full sales return: restocks items, reverses ledger, reduces customer balance. */
export async function postSalesReturn(sb: SupabaseClient, r: {
  invoice: any; return_no: string; return_date: string; refund_mode: string; reason: string; lines: ReturnLine[];
}) {
  const lines = r.lines.filter(l => l.qty > 0);
  if (!r.invoice?.id || !lines.length) throw new Error("Select a bill and enter return quantities");
  return atomicSave<number>(sb, "post_financial_return", { _return: {
    invoice_id: r.invoice.id, return_no: r.return_no, return_date: r.return_date,
    refund_mode: r.refund_mode, reason: r.reason,
    lines: lines.map(l => ({ invoice_item_id: l.invoice_item_id, qty: l.qty })),
  }});
}

/** Adjustment uses reviewed values and commits the movement and product together. */
export async function adjustStock(sb: SupabaseClient, p: any, a: { quantity: number; cost_price: number; unit_price: number; reason: string }) {
  return atomicSave<number>(sb, "post_financial_stock", { _product_id: p.id, _change: {
    ...a, mode: "adjustment", expected_quantity: Number(p.quantity), expected_cost: Number(p.cost_price ?? 0), expected_price: Number(p.unit_price),
  }});
}

export async function postStockMovement(sb: SupabaseClient, productId: string, type: "in" | "out", quantity: number, reason: string) {
  return atomicSave<number>(sb, "post_financial_stock", { _product_id: productId, _change: { mode: type, quantity, reason } });
}

export async function postJournal(sb: SupabaseClient, entry: { entry_date: string; reference: string; description: string }, lines: Array<{ account_id: string; debit: number; credit: number }>) {
  return atomicSave<string>(sb, "post_financial_journal", { _entry: entry, _lines: lines });
}
