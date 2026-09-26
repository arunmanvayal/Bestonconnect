import type { SupabaseClient } from "@supabase/supabase-js";

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
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineCalc(l: Line) {
  const gross = l.quantity * l.rate;
  const taxable = Math.max(0, gross - l.discount);
  const tax = (taxable * l.gst_rate) / 100;
  return { gross, taxable, tax, amount: taxable + tax };
}

export function totals(lines: Line[], h: Header) {
  let gross = 0, lineDisc = 0, taxable = 0, tax = 0;
  for (const l of lines) {
    const c = lineCalc(l);
    gross += c.gross;
    lineDisc += l.discount;
    taxable += c.taxable;
    tax += c.tax;
  }
  // Bill-level discount reduces taxable proportionally
  const ratio = taxable > 0 ? Math.max(0, taxable - h.bill_discount) / taxable : 1;
  taxable *= ratio;
  tax = h.tax_type === "none" ? 0 : tax * ratio;
  const cgst = h.tax_type === "gst" ? tax / 2 : 0;
  const sgst = cgst;
  const igst = h.tax_type === "igst" ? tax : 0;
  const totalValue = taxable + tax;
  const beforeRound = totalValue + h.other_exp + h.freight - h.cash_disc;
  const net = Math.round(beforeRound);
  return {
    gross: r2(gross), discount: r2(lineDisc + h.bill_discount), taxable: r2(taxable),
    cgst: r2(cgst), sgst: r2(sgst), igst: r2(igst), total_tax: r2(tax),
    total_value: r2(totalValue), round_off: r2(net - beforeRound), net_total: net,
    total_qty: lines.reduce((s, l) => s + l.quantity + l.free_qty, 0),
  };
}

async function ensureAccount(sb: SupabaseClient, code: string, name: string, type: string) {
  const { data } = await sb.from("accounts").select("id").eq("code", code).limit(1);
  if (data && data[0]) return data[0].id as string;
  const { data: ins, error } = await sb.from("accounts").insert({ code, name, type }).select("id").single();
  if (error) throw error;
  return ins.id as string;
}

async function ensureParty(sb: SupabaseClient, name: string, contact: string, kind: Kind, address: string) {
  if (!name.trim()) return null;
  const { data } = await sb.from("customers").select("id").ilike("name", name.trim()).limit(1);
  if (data && data[0]) return data[0].id as string;
  const { data: ins, error } = await sb
    .from("customers")
    .insert({ name: name.trim(), phone: contact, address, party_type: kind === "sale" ? "customer" : "supplier" })
    .select("id").single();
  if (error) throw error;
  return ins.id as string;
}

/** Saves an invoice and syncs stock, parties and double-entry ledger. */
export async function postInvoice(sb: SupabaseClient, kind: Kind, h: Header, rawLines: Line[]) {
  const lines = rawLines.filter((l) => l.item_name.trim() && l.quantity > 0);
  if (lines.length === 0) throw new Error("Add at least one item with quantity");
  const t = totals(lines, h);
  const party_id = await ensureParty(sb, h.party_name, h.contact, kind, h.billing_address);

  // Ledger accounts
  const payCode: [string, string, string] = h.payment_mode === "credit"
    ? (kind === "sale" ? ["1100", "Accounts Receivable", "asset"] : ["2000", "Accounts Payable", "liability"])
    : h.payment_mode === "bank" || h.payment_mode === "upi"
      ? ["1010", "Bank", "asset"] : ["1000", "Cash", "asset"];
  const payAcc = await ensureAccount(sb, payCode[0], payCode[1], payCode[2]);
  const mainAcc = kind === "sale"
    ? await ensureAccount(sb, "4000", "Sales", "income")
    : await ensureAccount(sb, "5000", "Purchases", "expense");
  const taxAcc = kind === "sale"
    ? await ensureAccount(sb, "2100", "GST Output", "liability")
    : await ensureAccount(sb, "1200", "GST Input", "asset");

  const { data: je, error: jeErr } = await sb.from("journal_entries").insert({
    entry_date: h.bill_date,
    reference: h.bill_no,
    description: `${kind === "sale" ? "Sales" : "Purchase"} invoice ${h.bill_no}${h.party_name ? " — " + h.party_name : ""}`,
  }).select("id").single();
  if (jeErr) throw jeErr;

  const mainAmt = r2(t.net_total - t.total_tax); // taxable + extras + round off
  const jl = kind === "sale"
    ? [
        { entry_id: je.id, account_id: payAcc, debit: t.net_total, credit: 0 },
        { entry_id: je.id, account_id: mainAcc, debit: 0, credit: mainAmt },
        { entry_id: je.id, account_id: taxAcc, debit: 0, credit: t.total_tax },
      ]
    : [
        { entry_id: je.id, account_id: mainAcc, debit: mainAmt, credit: 0 },
        { entry_id: je.id, account_id: taxAcc, debit: t.total_tax, credit: 0 },
        { entry_id: je.id, account_id: payAcc, debit: 0, credit: t.net_total },
      ];
  const { error: jlErr } = await sb.from("journal_lines").insert(jl.filter((l) => l.debit || l.credit));
  if (jlErr) throw jlErr;

  const { data: inv, error: invErr } = await sb.from("invoices").insert({
    kind, bill_no: h.bill_no, bill_date: h.bill_date, party_id, party_name: h.party_name, contact: h.contact,
    payment_mode: h.payment_mode, tax_type: h.tax_type, bill_type: h.bill_type, salesman: h.salesman, ref_no: h.ref_no,
    gross: t.gross, discount: t.discount, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst,
    total_tax: t.total_tax, other_exp: h.other_exp, freight: h.freight, cash_disc: h.cash_disc,
    round_off: t.round_off, net_total: t.net_total, remarks: h.remarks,
    shipping_address: h.shipping_address, billing_address: h.billing_address, journal_entry_id: je.id,
  }).select("id").single();
  if (invErr) throw invErr;

  for (const l of lines) {
    const c = lineCalc(l);
    let productId = l.product_id;
    if (!productId) {
      // New item on purchase/sale — create it in stock
      const { data: p, error } = await sb.from("products").insert({
        name: l.item_name, sku: l.barcode, barcode: l.barcode, unit: l.unit || "pcs", quantity: 0,
        unit_price: kind === "sale" ? l.rate : r2(l.rate * (1 + l.profit_pct / 100)),
        cost_price: kind === "purchase" ? l.rate : 0, gst_rate: l.gst_rate,
      }).select("id").single();
      if (error) throw error;
      productId = p.id;
    }
    await sb.from("invoice_items").insert({
      invoice_id: inv.id, product_id: productId, item_name: l.item_name, unit: l.unit,
      quantity: l.quantity, free_qty: l.free_qty, rate: l.rate, discount: l.discount, gst_rate: l.gst_rate,
      taxable: r2(c.taxable), tax: r2(c.tax), amount: r2(c.amount),
    });
    const qty = l.quantity + l.free_qty;
    await sb.from("stock_movements").insert({
      product_id: productId, type: kind === "sale" ? "out" : "in", quantity: qty,
      note: `${kind === "sale" ? "Sale" : "Purchase"} ${h.bill_no}`,
    });
    const { data: cur } = await sb.from("products").select("quantity").eq("id", productId).single();
    const update: Record<string, number> = {
      quantity: Number(cur?.quantity ?? 0) + (kind === "sale" ? -qty : qty),
    };
    if (kind === "purchase") {
      update["cost_price"] = l.rate;
      if (l.profit_pct > 0) update["unit_price"] = r2(l.rate * (1 + l.profit_pct / 100));
    }
    await sb.from("products").update(update).eq("id", productId);
  }
  return inv.id as string;
}

/** Live account balances = opening balance + ledger activity. */
export async function fetchBalances(sb: SupabaseClient) {
  const [{ data: accounts, error }, { data: lines }] = await Promise.all([
    sb.from("accounts").select("*").order("code"),
    sb.from("journal_lines").select("account_id, debit, credit"),
  ]);
  if (error) throw error;
  return (accounts ?? []).map((a: any) => {
    let dr = 0, cr = 0;
    for (const l of lines ?? []) if (l.account_id === a.id) { dr += Number(l.debit); cr += Number(l.credit); }
    const debitNature = a.type === "asset" || a.type === "expense";
    const balance = Number(a.opening_balance ?? 0) + (debitNature ? dr - cr : cr - dr);
    return { ...a, debit_total: dr, credit_total: cr, balance };
  });
}

export const INVOICE_QUERY_KEYS = [
  ["invoices"], ["products"], ["accounts"], ["balances"], ["dashboard"], ["journal"], ["journal_entries"], ["customers"], ["ledger"],
];
