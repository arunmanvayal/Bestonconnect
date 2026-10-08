import { fetchAll } from "@/lib/data-transfer";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, RefreshCw, Save, Printer, Plus, FileText, Columns3, Search, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/lib/supabase";
import { money } from "@/components/SupabaseGate";
import { type Header, type Kind, type Line, lineCalc, postInvoice, updateSalesInvoice, totals } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceCommands, useWorkspacePreferences } from "@/lib/workspace-preferences";

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({
  product_id: null, item_name: "", barcode: "", unit: "pcs", quantity: 0, free_qty: 0, rate: 0, discount: 0, gst_rate: 18, profit_pct: 0,
});
const emptyHeader = (kind: Kind): Header => ({
  bill_no: "", bill_date: today(), party_name: "", contact: "", payment_mode: "cash", tax_type: "gst",
  bill_type: kind === "sale" ? "B2C" : "Cash", salesman: "", ref_no: "", bill_discount: 0, other_exp: 0,
  freight: 0, cash_disc: 0, remarks: "", shipping_address: "", billing_address: "",
});

const cellInput = "h-8 w-full rounded-none border-0 bg-transparent px-2 text-sm focus-visible:ring-1 focus-visible:ring-primary";
const selectCls = "h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

export function InvoiceForm({ kind }: { kind: Kind }) {
  const sb = useSupabase()!;
  const qc = useQueryClient();
  const [h, setH] = useState<Header>(emptyHeader(kind));
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [selected, setSelected] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [loadingBill, setLoadingBill] = useState(false);
  const isSale = kind === "sale";
  const { shortcuts, columnWidths, setColumnWidths, resetColumnWidths } = useWorkspacePreferences();
  const widthKey = `invoice-${kind}`;
  const defaultWidths = isSale ? [42, 112, 210, 72, 70, 78, 92, 78, 70, 112] : [42, 112, 210, 72, 78, 78, 96, 82, 96, 70, 112];
  const widths = columnWidths[widthKey] ?? defaultWidths;

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const data = await fetchAll(sb, "products"); const error = null;
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: parties = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await sb.from("customers").select("*").order("name")).data ?? [],
  });
  const { data: invoices = [], error: invError } = useQuery({
    queryKey: ["invoices", kind],
    queryFn: async () => {
      const { data, error } = await sb.from("invoices").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const nextNo = `${isSale ? "RT" : "PI"}${String(1000 + invoices.length + 1)}`;
  const billNo = h.bill_no || nextNo;
  const t = useMemo(() => totals(lines, h), [lines, h]);
  const set = <K extends keyof Header>(k: K, v: Header[K]) => setH((p) => ({ ...p, [k]: v }));
  const num = (v: string) => Number(v) || 0;

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => {
      const next = ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
      if (i === next.length - 1 && next[i]?.item_name) next.push(emptyLine());
      return next;
    });

  const genBarcode = () => `BD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const fillFromProduct = (i: number, p: any, code?: string) =>
    updateLine(i, {
      product_id: p.id, item_name: p.name, barcode: code ?? (isSale ? p.barcode || p.sku || "" : genBarcode()), unit: p.unit || "pcs",
      rate: Number(isSale ? p.unit_price : p.cost_price || p.unit_price) || 0,
      gst_rate: Number(p.gst_rate ?? 18), quantity: lines[i]?.quantity || 1,
    });

  const findByCode = (code: string) => {
    const c = code.trim().toLowerCase();
    if (!c) return undefined;
    return products.find((x) => (x.barcode && String(x.barcode).toLowerCase() === c) || (x.sku && String(x.sku).toLowerCase() === c));
  };

  const onBarcode = (i: number, code: string) => {
    const p = findByCode(code);
    if (p) fillFromProduct(i, p, code);
    else updateLine(i, { barcode: code });
  };

  const pickItem = (i: number, name: string) => {
    const byCode = findByCode(name);
    if (byCode) return fillFromProduct(i, byCode, name);
    updateLine(i, { product_id: null, item_name: name });
  };

  const [suggest, setSuggest] = useState<{ row: number; top: number; left: number; width: number } | null>(null);
  const [hi, setHi] = useState(0);
  const openSuggest = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setSuggest({ row: i, top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 328)), width: Math.max(r.width, 320) });
    setHi(0);
  };
  const query = suggest ? (lines[suggest.row]?.item_name ?? "").toLowerCase().trim() : "";
  const matches = suggest
    ? products.filter((p) => !query || p.name.toLowerCase().includes(query) || String(p.barcode ?? "").toLowerCase().includes(query) || String(p.sku ?? "").toLowerCase().includes(query)).slice(0, 8)
    : [];
  const choose = (i: number, p: any) => {
    fillFromProduct(i, p);
    setSuggest(null);
    setTimeout(() => {
      const el = tbodyRef.current?.querySelector<HTMLInputElement>(`input[data-row="${i}"][data-col="qty"]`);
      el?.focus(); el?.select();
    }, 0);
  };
  const onItemKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggest || matches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && query) { e.preventDefault(); e.stopPropagation(); choose(i, matches[hi] ?? matches[0]); }
    else if (e.key === "Escape") setSuggest(null);
  };

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLInputElement;
    if (target.tagName !== "INPUT") return;
    e.preventDefault();
    const row = Number(target.dataset['row']);
    if (target.dataset['col'] === "barcode") onBarcode(row, target.value);
    // wait for re-render (new row may be appended) then focus next field
    setTimeout(() => {
      const inputs = Array.from(tbodyRef.current?.querySelectorAll<HTMLInputElement>("input") ?? []);
      const idx = inputs.findIndex((el) => el.dataset['row'] === String(row) && el.dataset['col'] === target.dataset['col']);
      const next = inputs[idx + 1];
      if (next) { next.focus(); next.select(); }
    }, 0);
  };

  const pickParty = (name: string) => {
    const p: any = parties.find((x: any) => x.name.toLowerCase() === name.toLowerCase());
    setH((prev) => ({ ...prev, party_name: name, contact: p?.phone ?? prev.contact, billing_address: p?.address ?? prev.billing_address }));
  };

  const reset = () => { setH(emptyHeader(kind)); setLines([emptyLine()]); setSelected(null); setEditingId(null); };

  const loadBill = async (no?: string) => {
    const q = (no ?? lookup).trim();
    if (!q) { toast.info("Type a bill number"); return; }
    if (loadingBill || save.isPending) return;
    if ((editingId || lines.some((l) => l.item_name.trim())) && !window.confirm("Replace the bill currently on screen? Unsaved changes will be lost.")) return;
    setLoadingBill(true);
    try {
    const { data: inv, error } = await sb.from("invoices").select("*").eq("kind", kind).ilike("bill_no", q.replace(/[\\%_]/g, "\\$&")).limit(2);
    if (error) throw error;
    if (inv && inv.length > 1) throw new Error("More than one bill has this number. Choose a bill from recent sales.");
    const bill = inv?.[0];
    if (!bill) { toast.error(`Bill ${q} not found`); return; }
    const { data: items, error: itemError } = await sb.from("invoice_items").select("*").eq("invoice_id", bill.id);
    if (itemError) throw itemError;
    const invData = bill;
    const extraDisc = Math.max(0, Number(bill.discount) - (items ?? []).reduce((a: number, i: any) => a + Number(i.discount || 0), 0));
    setH({
      bill_no: invData.bill_no, bill_date: invData.bill_date, party_name: invData.party_name ?? "", contact: invData.contact ?? "",
      payment_mode: invData.payment_mode ?? "cash", tax_type: invData.tax_type ?? "gst", bill_type: invData.bill_type ?? "", salesman: invData.salesman ?? "",
      ref_no: invData.ref_no ?? "", bill_discount: Math.round(extraDisc * 100) / 100, other_exp: Number(invData.other_exp) || 0, freight: Number(invData.freight) || 0,
      cash_disc: Number(invData.cash_disc) || 0, remarks: invData.remarks ?? "", shipping_address: invData.shipping_address ?? "", billing_address: invData.billing_address ?? "",
    });
    setLines((items ?? []).map((i: any) => {
      const p = products.find((x: any) => x.id === i.product_id);
      return { product_id: i.product_id, item_name: i.item_name, barcode: p?.barcode ?? "", unit: i.unit || "pcs", quantity: Number(i.quantity), free_qty: Number(i.free_qty) || 0,
        rate: Number(i.rate), discount: Number(i.discount) || 0, gst_rate: Number(i.gst_rate), profit_pct: 0 };
    }).concat([emptyLine()]));
    setEditingId(bill.id); lastSavedId.current = bill.id; setLookup(""); setSelected(null); setSuggest(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load bill"); }
    finally { setLoadingBill(false); }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) {
        if (!confirm(`Update bill ${billNo}? Stock and ledger will be recalculated.`)) throw new Error("Update cancelled");
        return updateSalesInvoice(sb, editingId, { ...h, bill_no: billNo }, lines);
      }
      if (isSale && !editingId) {
        for (const l of lines) {
          const p = products.find((x) => x.id === l.product_id);
          if (p && l.quantity + l.free_qty > Number(p.quantity)) throw new Error(`Only ${Number(p.quantity)} ${p.unit} of ${p.name} in stock`);
        }
      }
      return postInvoice(sb, kind, { ...h, bill_no: billNo }, lines);
    },
    onSuccess: (id) => {
      lastSavedId.current = id;
      toast.success(`${isSale ? "Sales" : "Purchase"} invoice ${billNo} ${editingId ? "updated" : "saved"} — stock and ledger updated`, {
        action: { label: "Print A4", onClick: () => window.open(`/invoice/${id}?print=1`, "_blank") },
      });
      void qc.invalidateQueries();
      if (!editingId) reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const lastSavedId = useRef<string | null>(null);
  const printInvoice = () => {
    if (!lastSavedId.current) { toast.info("Save the bill first, then print it on A4"); return; }
    window.open(`/invoice/${lastSavedId.current}?print=1`, "_blank");
  };
  const addRow = () => setLines((ls) => [...ls, emptyLine()]);
  const removeSelected = () => {
    if (selected === null) return;
    setLines((ls) => ls.length > 1 ? ls.filter((_, i) => i !== selected) : [emptyLine()]);
    setSelected(null);
  };
  const focusProduct = () => {
    const row = selected ?? 0;
    const input = tbodyRef.current?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="item"]`);
    input?.focus(); input?.select();
  };
  useWorkspaceCommands({ save: () => save.mutate(), addRow, removeRow: removeSelected, print: printInvoice, refresh: reset, focusProduct });

  const startResize = (index: number, event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widths[index] ?? defaultWidths[index] ?? 80;
    const onMove = (move: PointerEvent) => {
      const next = [...widths];
      next[index] = Math.max(index === 2 ? 150 : 54, startWidth + move.clientX - startX);
      setColumnWidths(widthKey, next);
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (invError) {
    return (
      <div className="max-w-lg rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
        <p className="font-semibold text-foreground">Invoice tables not found</p>
        <p className="mt-2 text-muted-foreground">Open the Setup page, copy the script and run it again in your Supabase SQL editor. It's safe to re-run.</p>
      </div>
    );
  }

  const cols = isSale
    ? ["#", "Barcode", "Item Name", "Unit", "Stock", "Qty", "Rate", "Disc", "GST %", "Amount"]
    : ["#", "Barcode", "Item Name", "Unit", "Qty", "Free Qty", "Unit Cost", "Profit %", "Sale Price", "GST %", "Amount"];

  return (
    <div className="entry-workspace space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><FileText className="h-5 w-5" /></div><div className="min-w-0"><h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">{isSale ? "Retail Invoice" : "Purchase Invoice"}</h1><p className="text-xs text-muted-foreground">Stock and ledger update automatically</p></div></div>
        <span className="hidden shrink-0 rounded-full bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm sm:block">{new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
      </div>

      {isSale && <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Enter bill number to open (e.g. RT1001)" value={lookup} onChange={(e) => setLookup(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void loadBill(); } }} />
        </div>
        <Button variant="secondary" disabled={loadingBill || save.isPending} onClick={() => void loadBill()}>{loadingBill ? "Loading…" : "Open bill"}</Button>
        {editingId && <>
          <span className="rounded-full bg-accent/30 px-3 py-1.5 text-xs font-semibold text-accent-foreground">Editing {billNo}</span>
          <Button variant="outline" size="sm" onClick={() => window.open(`/invoice/${editingId}`, "_blank")}><Eye className="mr-1.5 h-4 w-4" />Preview</Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/invoice/${editingId}?print=1`, "_blank")}><Printer className="mr-1.5 h-4 w-4" />Reprint</Button>
          <Button variant="ghost" size="sm" onClick={reset}><X className="mr-1.5 h-4 w-4" />New bill</Button>
        </>}
      </div>}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm">
        {/* Header */}
        <div className="grid gap-4 border-b border-border/70 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Bill No"><Input value={billNo} onChange={(e) => set("bill_no", e.target.value)} /></Field>
          <Field label="Bill Date"><Input type="date" value={h.bill_date} onChange={(e) => set("bill_date", e.target.value)} /></Field>
          <Field label={isSale ? "MOP" : "Bill Type"}>
            <select className={selectCls} value={h.payment_mode} onChange={(e) => set("payment_mode", e.target.value)}>
              <option value="cash">Cash</option><option value="credit">Credit</option>
              <option value="bank">Bank</option><option value="upi">UPI</option>
            </select>
          </Field>
          <Field label="Tax Type">
            <select className={selectCls} value={h.tax_type} onChange={(e) => set("tax_type", e.target.value)}>
              <option value="gst">GST (CGST+SGST)</option><option value="igst">IGST</option><option value="none">No Tax</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label={isSale ? "Party" : "Supplier"}>
              <Input list={`parties-${kind}`} placeholder={isSale ? "Customer name (new names are added automatically)" : "Supplier name"} value={h.party_name} onChange={(e) => pickParty(e.target.value)} />
              <datalist id={`parties-${kind}`}>
                {parties.filter((p: any) => (p.party_type ?? "customer") === (isSale ? "customer" : "supplier") || true).map((p: any) => <option key={p.id} value={p.name} />)}
              </datalist>
            </Field>
          </div>
          <Field label="Contact No"><Input value={h.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
          {isSale ? (
            <Field label="Bill Type">
              <select className={selectCls} value={h.bill_type} onChange={(e) => set("bill_type", e.target.value)}>
                <option>B2C</option><option>B2B</option>
              </select>
            </Field>
          ) : (
            <Field label="Ref No"><Input value={h.ref_no} placeholder="Supplier bill no" onChange={(e) => set("ref_no", e.target.value)} /></Field>
          )}
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* Items grid */}
          <div className="min-w-0 border-b border-border xl:border-b-0 xl:border-r">
            <div className="overflow-x-auto">
              <table className="invoice-grid w-full table-fixed text-sm" style={{ minWidth: widths.reduce((sum, width) => sum + width, 0) }}>
                <colgroup>{widths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
                <thead className="bg-primary text-primary-foreground">
                  <tr>{cols.map((c, index) => <th key={c} className="relative px-2 py-2 text-left font-medium"><span className="block truncate">{c}</span><span role="separator" aria-orientation="vertical" aria-label={`Resize ${c} column`} onPointerDown={(event) => startResize(index, event)} className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none border-r border-primary-foreground/25 hover:bg-primary-foreground/15" /></th>)}</tr>
                </thead>
                <tbody ref={tbodyRef} onKeyDown={onGridKeyDown}>
                  {lines.map((l, i) => {
                    const c = lineCalc(l);
                    const stock = products.find((p) => p.id === l.product_id);
                    return (
                      <tr key={i} onClick={() => setSelected(i)} className={`border-b border-border ${selected === i ? "bg-primary/10" : ""}`}>
                        <td className="w-8 px-2 text-muted-foreground">{i + 1}</td>
                        <td className="w-28"><Input className={cellInput} data-row={i} data-col="barcode" value={l.barcode} onChange={(e) => onBarcode(i, e.target.value)} placeholder="Scan / type" /></td>
                        <td className="min-w-48">
                          <Input className={cellInput} data-row={i} data-col="item" autoComplete="off" placeholder="Search item…" value={l.item_name}
                            onFocus={(e) => openSuggest(i, e.currentTarget)}
                            onChange={(e) => { pickItem(i, e.target.value); openSuggest(i, e.currentTarget); }}
                            onBlur={() => setTimeout(() => setSuggest((s) => (s?.row === i ? null : s)), 150)}
                            onKeyDown={(e) => onItemKeyDown(i, e)} />
                        </td>
                        <td className="w-16"><Input className={cellInput} data-row={i} data-col="unit" value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} /></td>
                        {isSale && <td className={`w-16 px-2 ${stock && Number(stock.quantity) < l.quantity ? "text-destructive" : "text-muted-foreground"}`}>{stock ? Number(stock.quantity) : "—"}</td>}
                        <td className="w-20"><Input className={cellInput} data-row={i} data-col="qty" type="number" value={l.quantity || ""} onChange={(e) => updateLine(i, { quantity: num(e.target.value) })} /></td>
                        {!isSale && <td className="w-20"><Input className={cellInput} data-row={i} data-col="free" type="number" value={l.free_qty || ""} onChange={(e) => updateLine(i, { free_qty: num(e.target.value) })} /></td>}
                        <td className="w-24"><Input className={cellInput} data-row={i} data-col="rate" type="number" value={l.rate || ""} onChange={(e) => updateLine(i, { rate: num(e.target.value) })} /></td>
                        {isSale ? (
                          <td className="w-20"><Input className={cellInput} data-row={i} data-col="disc" type="number" value={l.discount || ""} onChange={(e) => updateLine(i, { discount: num(e.target.value) })} /></td>
                        ) : (
                          <>
                            <td className="w-20"><Input className={cellInput} data-row={i} data-col="profit" type="number" value={l.profit_pct || ""} onChange={(e) => updateLine(i, { profit_pct: num(e.target.value) })} /></td>
                            <td className="w-24 px-2 text-muted-foreground">{l.profit_pct ? (l.rate * (1 + l.profit_pct / 100)).toFixed(2) : "—"}</td>
                          </>
                        )}
                        <td className="w-16"><Input className={cellInput} data-row={i} data-col="gst" type="number" value={l.gst_rate} onChange={(e) => updateLine(i, { gst_rate: num(e.target.value) })} /></td>
                        <td className="w-28 px-2 text-right font-medium">{c.amount ? c.amount.toFixed(2) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="product-list-unused">{products.map((p) => <option key={p.id} value={p.name}>{`Stock ${Number(p.quantity)} · ₹${p.unit_price}`}</option>)}</datalist>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-3 py-2">
              <Button size="sm" variant="ghost" title={`Add row · ${shortcuts.addRow}`} onClick={addRow}><Plus className="mr-1 h-4 w-4" />Add row</Button>
              <Button size="sm" variant="ghost" title="Reset column widths" onClick={() => resetColumnWidths(widthKey)}><Columns3 className="mr-1 h-4 w-4" />Reset columns</Button>
              <span className="ml-auto text-sm text-muted-foreground">Total Qty</span>
              <span className="rounded bg-primary px-3 py-0.5 text-sm font-semibold text-primary-foreground">{t.total_qty}</span>
            </div>

            <div className="grid gap-3 border-t border-border p-4 md:grid-cols-3">
              <Field label="Salesman"><Input value={h.salesman} onChange={(e) => set("salesman", e.target.value)} /></Field>
              <div className="md:col-span-2"><Field label="Remarks"><Input value={h.remarks} onChange={(e) => set("remarks", e.target.value)} /></Field></div>
              <div className="space-y-1 md:col-span-1">
                <span className="text-xs text-muted-foreground">Billing Address</span>
                <textarea className="h-16 w-full rounded-md border border-input bg-background p-2 text-sm" value={h.billing_address} onChange={(e) => set("billing_address", e.target.value)} />
              </div>
              {isSale && (
                <div className="space-y-1 md:col-span-1">
                  <span className="text-xs text-muted-foreground">Shipping Address</span>
                  <textarea className="h-16 w-full rounded-md border border-input bg-background p-2 text-sm" value={h.shipping_address} onChange={(e) => set("shipping_address", e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Bill details */}
          <div className="flex flex-col">
            <div className="bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Bill Details</div>
            <div className="flex-1 space-y-1.5 p-4 text-sm">
              {[
                ["Gross Total", t.gross], ["Taxable", t.taxable], ["Total Tax", t.total_tax],
                ["CGST Amt", t.cgst], ["SGST Amt", t.sgst], ["IGST Amt", t.igst], ["Total Value", t.total_value],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium tabular-nums">{Number(v).toFixed(2)}</span></div>
              ))}
              <div className="my-2 border-t border-border" />
              {([["Discount", "bill_discount"], ["Oth. Exp", "other_exp"], ["Freight", "freight"], ["Cash Disc", "cash_disc"]] as const).map(([k, key]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{k}</span>
                  <Input className="h-7 w-28 text-right" type="number" value={h[key] || ""} onChange={(e) => set(key, num(e.target.value))} />
                </div>
              ))}
              <div className="flex justify-between"><span className="text-muted-foreground">Round Off (auto)</span><span className="tabular-nums">{t.round_off.toFixed(2)}</span></div>
            </div>
            <div className="bg-primary px-4 py-5 text-right font-display text-2xl font-bold tabular-nums text-primary-foreground sm:text-3xl">{money(t.net_total)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/40 p-3 sm:flex sm:flex-wrap sm:justify-end">
          <Button variant="outline" title={`Remove row · ${shortcuts.removeRow}`} disabled={selected === null} onClick={removeSelected}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
          <Button variant="outline" title={`Refresh · ${shortcuts.refresh}`} onClick={reset}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button variant="outline" title={`Print · ${shortcuts.print}`} onClick={printInvoice}><Printer className="mr-2 h-4 w-4" />Print</Button>
          <Button title={`Save · ${shortcuts.save}`} onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : editingId ? "Update" : "Save"}</Button>
        </div>
      </div>

      {suggest && matches.length > 0 && (
        <div className="fixed z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
          style={{ top: suggest.top, left: suggest.left, width: suggest.width }}>
          {matches.map((p, idx) => (
            <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); choose(suggest.row, p); }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${idx === hi ? "bg-primary/10" : "hover:bg-muted"}`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.barcode || p.sku || "No barcode"} · Stock {Number(p.quantity)} {p.unit}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">₹{Number(isSale ? p.unit_price : p.cost_price || p.unit_price)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Always-visible total */}
      <div className="sticky bottom-20 z-20 flex items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-xl backdrop-blur-xl lg:bottom-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Qty {t.total_qty} · Tax {money(t.total_tax)}</p>
          <p className="font-display text-xl font-bold tabular-nums text-foreground sm:text-2xl">{money(t.net_total)}</p>
        </div>
        <Button className="ml-auto" title={`Save · ${shortcuts.save}`} onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : editingId ? "Update" : "Save"}</Button>
      </div>

      {/* Recent invoices */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
        <div className="border-b border-border px-4 py-3 font-semibold text-foreground">Recent {isSale ? "sales" : "purchase"} invoices</div>
        {invoices.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="px-4 py-2">Bill No</th><th>Date</th><th>{isSale ? "Party" : "Supplier"}</th><th>Mode</th><th className="text-right">Tax</th><th className="px-4 text-right">Net Total</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{isSale ? <Button variant="link" className="h-auto p-0" disabled={loadingBill || save.isPending} onClick={() => void loadBill(inv.bill_no)}>{inv.bill_no}</Button> : inv.bill_no}</td><td>{inv.bill_date}</td><td>{inv.party_name || "Walk-in"}</td>
                  <td className="capitalize">{inv.payment_mode}</td><td className="text-right">{money(inv.total_tax)}</td>
                  <td className="px-4 text-right font-semibold">{money(inv.net_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
