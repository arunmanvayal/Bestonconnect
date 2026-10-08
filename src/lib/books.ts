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
    const update: Record<string, number | string> = {
      quantity: Number(cur?.quantity ?? 0) + (kind === "sale" ? -qty : qty),
    };
    if (kind === "purchase") {
      update["cost_price"] = l.rate;
      if (l.barcode) { update["barcode"] = l.barcode; update["sku"] = l.barcode; }
      if (l.profit_pct > 0) update["unit_price"] = r2(l.rate * (1 + l.profit_pct / 100));
    }
    await sb.from("products").update(update).eq("id", productId);
  }
  return inv.id as string;
}

/** A single transactional database operation keeps the original bill ID. */
export async function updateSalesInvoice(sb: SupabaseClient, invoiceId: string, h: Header, rawLines: Line[]) {
  const lines = rawLines.filter((l) => l.item_name.trim() && l.quantity > 0);
  if (!lines.length) throw new Error("Add at least one item with quantity");
  const { data, error } = await sb.rpc("update_sales_invoice", { _invoice_id: invoiceId, _header: h, _lines: lines });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") throw new Error("Run the updated Setup script in your database SQL Editor once to enable safe bill updates. Your original bill is unchanged.");
    throw error;
  }
  return data as string;
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
  ["invoices"], ["products"], ["accounts"], ["balances"], ["dashboard"], ["journal"], ["journal_entries"], ["customers"], ["ledger"], ["payments"], ["outstanding"], ["returns"], ["reports"],
];

export type PayKind = "receipt" | "payment";

/** Records a customer receipt or supplier payment and posts it to the ledger. */
export async function postPayment(sb: SupabaseClient, p: {
  kind: PayKind; voucher_no: string; pay_date: string; party_id: string | null; party_name: string;
  amount: number; mode: string; reference: string; notes: string;
}) {
  if (!p.party_name.trim()) throw new Error("Select a party");
  if (!(p.amount > 0)) throw new Error("Enter an amount");
  const cashAcc = p.mode === "cash"
    ? await ensureAccount(sb, "1000", "Cash", "asset")
    : await ensureAccount(sb, "1010", "Bank", "asset");
  const partyAcc = p.kind === "receipt"
    ? await ensureAccount(sb, "1100", "Accounts Receivable", "asset")
    : await ensureAccount(sb, "2000", "Accounts Payable", "liability");
  const { data: je, error } = await sb.from("journal_entries").insert({
    entry_date: p.pay_date, reference: p.voucher_no,
    description: `${p.kind === "receipt" ? "Receipt from" : "Payment to"} ${p.party_name}`,
  }).select("id").single();
  if (error) throw error;
  const amt = r2(p.amount);
  const jl = p.kind === "receipt"
    ? [{ entry_id: je.id, account_id: cashAcc, debit: amt, credit: 0 }, { entry_id: je.id, account_id: partyAcc, debit: 0, credit: amt }]
    : [{ entry_id: je.id, account_id: partyAcc, debit: amt, credit: 0 }, { entry_id: je.id, account_id: cashAcc, debit: 0, credit: amt }];
  const { error: e2 } = await sb.from("journal_lines").insert(jl);
  if (e2) throw e2;
  const { error: e3 } = await sb.from("payments").insert({ ...p, amount: amt, journal_entry_id: je.id });
  if (e3) throw e3;
}

/** Outstanding per party: credit bills minus receipts/payments. */
export async function fetchOutstanding(sb: SupabaseClient) {
  const [{ data: inv }, { data: pays }, { data: rets }, { data: parties }] = await Promise.all([
    sb.from("invoices").select("kind, party_id, party_name, net_total, payment_mode, bill_no, bill_date"),
    sb.from("payments").select("*").order("pay_date", { ascending: false }),
    sb.from("sales_returns").select("party_id, party_name, amount, refund_mode"),
    sb.from("customers").select("*"),
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
  const [{ data: items, error }, { data: prev }] = await Promise.all([
    sb.from("invoice_items").select("*").eq("invoice_id", invoiceId),
    sb.from("sales_return_items").select("invoice_item_id, quantity, sales_returns!inner(invoice_id)").eq("sales_returns.invoice_id", invoiceId),
  ]);
  if (error) throw error;
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
  const lines = r.lines.filter((l) => l.qty > 0);
  if (lines.length === 0) throw new Error("Enter a return quantity for at least one item");
  for (const l of lines) if (l.qty > l.sold - l.returned) throw new Error(`Only ${l.sold - l.returned} of ${l.item_name} can be returned`);
  const taxable = r2(lines.reduce((a, l) => a + l.unitTaxable * l.qty, 0));
  const tax = r2(lines.reduce((a, l) => a + l.unitTax * l.qty, 0));
  const amount = r2(taxable + tax);
  const retAcc = await ensureAccount(sb, "4010", "Sales Returns", "income");
  const taxAcc = await ensureAccount(sb, "2100", "GST Output", "liability");
  const payAcc = r.refund_mode === "credit"
    ? await ensureAccount(sb, "1100", "Accounts Receivable", "asset")
    : r.refund_mode === "bank" ? await ensureAccount(sb, "1010", "Bank", "asset") : await ensureAccount(sb, "1000", "Cash", "asset");
  const { data: je, error } = await sb.from("journal_entries").insert({
    entry_date: r.return_date, reference: r.return_no,
    description: `Sales return ${r.return_no} against ${r.invoice.bill_no}${r.invoice.party_name ? " — " + r.invoice.party_name : ""}`,
  }).select("id").single();
  if (error) throw error;
  const jl = [
    { entry_id: je.id, account_id: retAcc, debit: taxable, credit: 0 },
    { entry_id: je.id, account_id: taxAcc, debit: tax, credit: 0 },
    { entry_id: je.id, account_id: payAcc, debit: 0, credit: amount },
  ].filter((l) => l.debit || l.credit);
  const { error: e2 } = await sb.from("journal_lines").insert(jl);
  if (e2) throw e2;
  const { data: ret, error: e3 } = await sb.from("sales_returns").insert({
    return_no: r.return_no, return_date: r.return_date, invoice_id: r.invoice.id, bill_no: r.invoice.bill_no,
    party_id: r.invoice.party_id, party_name: r.invoice.party_name, refund_mode: r.refund_mode,
    taxable, total_tax: tax, amount, reason: r.reason, journal_entry_id: je.id,
  }).select("id").single();
  if (e3) throw e3;
  for (const l of lines) {
    await sb.from("sales_return_items").insert({
      return_id: ret.id, invoice_item_id: l.invoice_item_id, product_id: l.product_id, item_name: l.item_name,
      quantity: l.qty, rate: l.rate, gst_rate: l.gst_rate,
      taxable: r2(l.unitTaxable * l.qty), tax: r2(l.unitTax * l.qty), amount: r2((l.unitTaxable + l.unitTax) * l.qty),
    });
    if (l.product_id) {
      await sb.from("stock_movements").insert({ product_id: l.product_id, type: "in", quantity: l.qty, note: `Sales return ${r.return_no}` });
      const { data: cur } = await sb.from("products").select("quantity").eq("id", l.product_id).single();
      await sb.from("products").update({ quantity: Number(cur?.quantity ?? 0) + l.qty }).eq("id", l.product_id);
    }
  }
  return amount;
}

/** Sets a product's stock quantity and prices, recording the difference as an adjustment. */
export async function adjustStock(sb: SupabaseClient, p: any, a: { quantity: number; cost_price: number; unit_price: number; reason: string }) {
  const diff = r2(a.quantity - Number(p.quantity));
  if (diff !== 0) {
    const { error } = await sb.from("stock_movements").insert({
      product_id: p.id, type: "adjustment", quantity: Math.abs(diff),
      note: `Adjustment ${diff > 0 ? "+" : "-"}${Math.abs(diff)}${a.reason ? " — " + a.reason : ""}`,
    });
    if (error) throw error;
  }
  const { error } = await sb.from("products").update({ quantity: a.quantity, cost_price: a.cost_price, unit_price: a.unit_price }).eq("id", p.id);
  if (error) throw error;
}
