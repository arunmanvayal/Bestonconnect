import { Link } from "@tanstack/react-router";
import { InvoiceEntryCells, invoiceColumns, invoiceWidths } from "@/components/InvoiceEntryGrid";
import { InvoiceEntryHeader, InvoiceEntryFooter } from "@/components/InvoiceEntryDetails";
import { emptyEntryDetails } from "@/lib/invoice-entry";
import { exportInvoiceLines, importInvoiceLines } from "@/lib/invoice-transfer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchAll } from "@/lib/data-transfer";
import { fetchNextInvoiceNumber } from "@/lib/invoice-number";
import { matchesSearch } from "@/lib/search";
import { productInvoiceDefaults } from "@/lib/masters";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, RefreshCw, Save, Printer, Plus, FileText, Columns3, Search, Eye, X, Upload, Download, History } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/lib/supabase";
import { money } from "@/components/SupabaseGate";
import { type Header, type Kind, type Line, postInvoice, updateSalesInvoice, totals } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceCommands, useWorkspacePreferences } from "@/lib/workspace-preferences";

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({
  product_id: null, item_name: "", barcode: "", unit: "pcs", quantity: 0, free_qty: 0, rate: 0, discount: 0, gst_rate: 18, profit_pct: 0, sku: "", serial_no: "", mrp: 0, sale_price: 0,
});
const emptyHeader = (kind: Kind): Header => ({
  bill_no: "", bill_date: today(), party_name: "", contact: "", payment_mode: "cash", tax_type: "gst",
  bill_type: kind === "sale" ? "B2CS" : "Cash", salesman: "", ref_no: "", bill_discount: 0, other_exp: 0,
  freight: 0, cash_disc: 0, remarks: "", shipping_address: "", billing_address: "", entry_details: emptyEntryDetails(today()),
});

const cellInput = "h-8 w-full rounded-none border-0 bg-transparent px-2 text-sm focus-visible:ring-1 focus-visible:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

export function InvoiceForm({ kind }: { kind: Kind }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [h, setH] = useState<Header>(emptyHeader(kind));
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [selected, setSelected] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [loadingBill, setLoadingBill] = useState(false);
  const [matchingBills, setMatchingBills] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isSale = kind === "sale";
  const { shortcuts, columnWidths, setColumnWidths, resetColumnWidths } = useWorkspacePreferences();
  const partyRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const widthKey = `invoice-reference-v2-${kind}`;
  const defaultWidths = invoiceWidths(kind);
  const widths = columnWidths[widthKey] ?? defaultWidths;

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      if (!sb) throw new Error("Database connection unavailable");
      const data = await fetchAll(sb, "products"); const error = null;
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: parties = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => sb ? fetchAll(sb, "customers") : [],
  });
  const { data: invoices = [], error: invError } = useQuery({
    queryKey: ["invoices", kind],
    queryFn: async () => {
      if (!sb) throw new Error("Database connection unavailable");
      const { data, error } = await sb.from("invoices").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: nextNo } = useQuery({
    queryKey: ["invoice-next-number", kind],
    enabled: !!sb,
    queryFn: () => {
      if (!sb) throw new Error("Database connection unavailable");
      return fetchNextInvoiceNumber(sb, kind);
    },
  });
  const billNo = h.bill_no || nextNo || "";
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
      ...productInvoiceDefaults(p, kind, h.tax_type), quantity: lines[i]?.quantity || 1,
    });

  const findByCode = (code: string) => {
    const c = code.trim().toLowerCase();
    if (!c) return undefined;
    return products.find((x) => !x.deactivated && ((x.barcode && String(x.barcode).toLowerCase() === c) || (x.sku && String(x.sku).toLowerCase() === c)));
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
    ? products.filter((p) => !p.deactivated && matchesSearch(query, p.name, p.barcode, p.sku, p.category, p.manufacturer, p.hsn)).slice(0, 8)
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
    const p: any = parties.find((x: any) => (x.party_type ?? "customer") === (isSale ? "customer" : "supplier") && x.name.toLowerCase() === name.toLowerCase());
    setH((prev) => ({ ...prev, party_name: name, contact: p?.phone || p?.contact_no || "", billing_address: p?.address ?? "" }));
  };

  const reset = () => { setH(emptyHeader(kind)); setLines([emptyLine()]); setSelected(null); setEditingId(null); setMatchingBills([]); };

  const loadBill = async (no?: string, invoiceId?: string) => {
    if (!sb) return;
    const q = (no ?? lookup).trim();
    if (!q) { toast.info("Type a bill number"); return; }
    if (loadingBill || save.isPending) return;
    if ((editingId || lines.some((l) => l.item_name.trim())) && !window.confirm("Replace the bill currently on screen? Unsaved changes will be lost.")) return;
    setLoadingBill(true);
    try {
    const search = sb.from("invoices").select("*").eq("kind", kind);
    const { data: inv, error } = await (invoiceId ? search.eq("id", invoiceId) : search.ilike("bill_no", q.replace(/[\\%_]/g, "\\$&"))).order("created_at", { ascending: false });
    if (error) throw error;
    if (inv && inv.length > 1) { setMatchingBills(inv); return; }
    setMatchingBills([]);
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
      entry_details: { ...emptyEntryDetails(invData.bill_date), ...(invData.entry_details ?? {}) },
      cash_disc: Number(invData.cash_disc) || 0, remarks: invData.remarks ?? "", shipping_address: invData.shipping_address ?? "", billing_address: invData.billing_address ?? "",
    });
    setLines((items ?? []).map((i: any): Line => {
      const p = products.find((x: any) => x.id === i.product_id);
      return { product_id: i.product_id, item_name: i.item_name, barcode: i.entry_details?.barcode ?? p?.barcode ?? "", sku: i.entry_details?.sku ?? p?.sku ?? "", serial_no: i.entry_details?.serial_no ?? "", mrp: Number(i.entry_details?.mrp ?? p?.mrp) || 0, sale_price: Number(i.entry_details?.sale_price ?? p?.unit_price) || 0, unit: i.unit || "pcs", quantity: Number(i.quantity), free_qty: Number(i.free_qty) || 0,
        rate: Number(i.rate), discount: Number(i.discount) || 0, gst_rate: Number(i.gst_rate), profit_pct: Number(i.entry_details?.profit_pct) || 0 };
    }).concat([emptyLine()]));
    setEditingId(bill.id); lastSavedId.current = bill.id; setLookup(""); setSelected(null); setSuggest(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load bill"); }
    finally { setLoadingBill(false); }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!sb) throw new Error("Database connection unavailable");
      if (editingId) {
        if (!confirm(`Update bill ${billNo}? Stock and ledger will be recalculated.`)) throw new Error("Update cancelled");
        const id = await updateSalesInvoice(sb, editingId, { ...h, bill_no: billNo }, lines);
        return { id, number: billNo };
      }
      if (isSale && !editingId) {
        for (const l of lines) {
          const p = products.find((x) => x.id === l.product_id);
          if (p && l.quantity + l.free_qty > Number(p.quantity)) throw new Error(`Only ${Number(p.quantity)} ${p.unit} of ${p.name} in stock`);
        }
      }
      const number = h.bill_no.trim() || await fetchNextInvoiceNumber(sb, kind);
      const id = await postInvoice(sb, kind, { ...h, bill_no: number }, lines);
      return { id, number };
    },
    onSuccess: ({ id, number }) => {
      lastSavedId.current = id;
      toast.success(`${isSale ? "Sales" : "Purchase"} invoice ${number} ${editingId ? "updated" : "saved"} — stock and ledger updated`, {
        action: { label: "Print A4", onClick: () => window.open(`/admin/invoice/${id}?print=1`, "_blank") },
      });
      void qc.invalidateQueries();
      if (!editingId) reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const lastSavedId = useRef<string | null>(null);
  const printInvoice = () => {
    if (!lastSavedId.current) { toast.info("Save the bill first, then print it on A4"); return; }
    window.open(`/admin/invoice/${lastSavedId.current}?print=1`, "_blank");
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
  useWorkspaceCommands({ save: () => save.mutate(), addRow, removeRow: removeSelected, print: printInvoice, refresh: reset, focusProduct, focusParty: () => partyRef.current?.focus() });

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

  const cols = invoiceColumns(kind);
  const mrpValue = lines.reduce((sum, l) => sum + (l.mrp ?? 0) * l.quantity, 0);
  return (
    <div className="entry-workspace invoice-entry-window">
      <div className="invoice-entry-title grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-primary"/><h1 className="truncate text-sm font-semibold">{isSale ? "Retail Invoice" : "Purchase Invoice"}</h1></div>
        <div className="flex shrink-0 items-center gap-1">
          {isSale && <><Input aria-label="Open bill number" className="invoice-lookup" placeholder="Bill number" value={lookup} onChange={e => setLookup(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void loadBill(); } }}/><Button size="sm" variant="secondary" disabled={loadingBill || save.isPending} onClick={() => void loadBill()}><Search className="h-3 w-3"/>Open</Button></>}
          {editingId && <><Button size="sm" variant="outline" onClick={() => window.open(`/admin/invoice/${editingId}`, "_blank")}><Eye className="h-3 w-3"/>Preview</Button><Button size="sm" variant="ghost" onClick={reset}>New bill</Button></>}
          <Button size="sm" variant="ghost" title="Recent invoices" aria-label="Recent invoices" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4"/></Button>
        </div>
      </div>

      {matchingBills.length > 0 && <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3">Bill No</th><th>Date</th><th>Customer</th><th>Total</th><th /></tr></thead>
          <tbody>{matchingBills.map((bill) => <tr key={bill.id} className="border-b border-border"><td className="p-3">{bill.bill_no}</td><td>{bill.bill_date}</td><td>{bill.party_name || "Walk-in"}</td><td>{money(bill.net_total)}</td><td className="p-2"><Button variant="outline" size="sm" disabled={loadingBill} onClick={() => void loadBill(bill.bill_no, bill.id)}>Open</Button></td></tr>)}</tbody>
        </table>
      </div>}

      <div className="invoice-entry-frame overflow-hidden border border-border bg-card">
        <InvoiceEntryHeader kind={kind} header={h} set={set} pickParty={pickParty} partyRef={partyRef} parties={parties.filter(p => (p.party_type ?? "customer") === (isSale ? "customer" : "supplier"))} billNo={billNo} />

        <div className="invoice-entry-body grid">
          {/* Items grid */}
          <div className="invoice-entry-left min-w-0 border-r border-border">
            <div className="invoice-items-scroll overflow-auto">
              <table className="invoice-grid w-full table-fixed text-sm" style={{ minWidth: columnWidths[widthKey] ? widths.reduce((sum, width) => sum + width, 0) : 1000 }}>
                <colgroup>{widths.map((width, index) => <col key={index} style={{ width: columnWidths[widthKey] ? width : `${width / widths.reduce((sum, value) => sum + value, 0) * 100}%` }} />)}</colgroup>
                <thead className="bg-primary text-primary-foreground">
                  <tr>{cols.map((c, index) => <th key={c} className="relative px-2 py-2 text-left font-medium"><span className="block truncate">{c}</span><span role="separator" aria-orientation="vertical" aria-label={`Resize ${c} column`} onPointerDown={(event) => startResize(index, event)} className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none border-r border-primary-foreground/25 hover:bg-primary-foreground/15" /></th>)}</tr>
                </thead>
                <tbody ref={tbodyRef} onKeyDown={onGridKeyDown}>
                  {lines.map((l, i) => {
                    return (
                      <tr key={i} onClick={() => setSelected(i)} className={`border-b border-border ${selected === i ? "bg-primary/10" : ""}`}>
                        <InvoiceEntryCells kind={kind} line={l} row={i} taxType={h.tax_type} update={patch => updateLine(i, patch)} barcode={value => onBarcode(i, value)} item={
                          <Input aria-label={`Item Name row ${i + 1}`} className={cellInput} data-row={i} data-col="item" autoComplete="off" placeholder="Search item…" value={l.item_name}
                            onFocus={e => openSuggest(i, e.currentTarget)}
                            onChange={e => { pickItem(i, e.target.value); openSuggest(i, e.currentTarget); }}
                            onBlur={() => setTimeout(() => setSuggest(s => s?.row === i ? null : s), 150)}
                            onKeyDown={e => onItemKeyDown(i, e)} />
                        } />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="product-list-unused">{products.map((p) => <option key={p.id} value={p.name}>{`Stock ${Number(p.quantity)} · ₹${p.unit_price}`}</option>)}</datalist>
            </div>
            <div className="invoice-grid-toolbar grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-t border-border px-2">
              <Button size="sm" variant="ghost" title={`Add row · ${shortcuts.addRow}`} onClick={addRow}><Plus className="mr-1 h-4 w-4" />Add row</Button>
              
              <span className="ml-auto text-sm text-muted-foreground">Total Qty</span>
              <span className="rounded bg-primary px-3 py-0.5 text-sm font-semibold text-primary-foreground">{t.total_qty}</span>
            </div>

            <InvoiceEntryFooter kind={kind} header={h} set={set} />
          </div>

          {/* Bill details */}
          <div className="invoice-bill-panel flex min-h-0 flex-col">
            <Tabs defaultValue="details" className="flex h-full flex-col gap-0">
              <TabsList className={`grid h-10 w-full rounded-none ${isSale ? "grid-cols-3" : "grid-cols-2"}`}><TabsTrigger value="details">Bill Details</TabsTrigger>{isSale && <TabsTrigger value="misc">Misc</TabsTrigger>}<TabsTrigger value="settings">Settings</TabsTrigger></TabsList>
              <TabsContent value="details" className="invoice-bill-fields space-y-2 p-3 text-xs">
                {([["Gross Total", t.gross], ["Taxable", t.taxable], ["Total Tax", t.total_tax], ...(isSale ? [["MRP Value", mrpValue]] : []), ["CGST Amt", t.cgst], ["SGST Amt", t.sgst], ["IGST Amt", t.igst]] as Array<[string, number]>).map(([label,value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2"><span>{label}</span><Input aria-label={label} readOnly className="h-8 text-right text-xs" value={value.toFixed(2)}/></div>)}
                {([["Discount", "bill_discount"], ["Oth.Exp", "other_exp"], ["Freight", "freight"], ["Cash Disc", "cash_disc"]] as const).map(([label,key]) => <label key={key} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2"><span>{label}</span><Input aria-label={label} className="h-8 text-right text-xs" type="number" min={0} value={h[key] || ""} onChange={e => set(key, num(e.target.value))}/></label>)}
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2"><span>Round Off</span><Input aria-label="Round Off" readOnly className="h-8 text-right text-xs" value={t.round_off.toFixed(2)}/></div>
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2"><span>Total Value</span><Input aria-label="Total Value" readOnly className="h-8 text-right text-xs" value={t.total_value.toFixed(2)}/></div>
              </TabsContent>
              {isSale && <TabsContent value="misc" className="space-y-3 p-3 text-xs"><Field label="Ref No"><Input value={h.ref_no} onChange={e => set("ref_no", e.target.value)}/></Field><Field label="Total Value"><Input readOnly value={t.total_value.toFixed(2)}/></Field><Field label="Total Discount"><Input readOnly value={t.discount.toFixed(2)}/></Field></TabsContent>}
              <TabsContent value="settings" className="space-y-3 p-3"><Button variant="outline" onClick={() => resetColumnWidths(widthKey)}><Columns3 className="h-4 w-4"/>Reset columns</Button><p className="text-xs text-muted-foreground">Round Off: AUTO</p></TabsContent>
              <div className="invoice-bill-amount mt-auto bg-primary px-4 py-4 text-right font-display text-3xl font-bold tabular-nums text-primary-foreground">{money(t.net_total)}</div>
            </Tabs>
          </div>
        </div>

        {/* Actions */}
        <div className="invoice-entry-actions grid grid-cols-2 gap-2 border-t border-border bg-muted/40 p-3 sm:flex sm:justify-end">
          <input ref={importRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return;
            try { const imported = await importInvoiceLines(file); const resolved = imported.map(l => { const product = products.find(p => (l.sku && p.sku === l.sku) || (l.barcode && p.barcode === l.barcode)); return { ...l, product_id: product?.id ?? null }; });
              if (lines.some(l => l.item_name.trim()) && !confirm("Replace current invoice items with this sheet?")) return;
              setLines([...resolved, emptyLine()]); toast.success(`${resolved.length} items imported`);
            } catch (error) { toast.error(error instanceof Error ? error.message : "Import failed"); } finally { e.target.value = ""; }
          }}/>
          <Button variant="outline" className="sm:mr-auto" onClick={() => isSale ? exportInvoiceLines(lines, billNo) : importRef.current?.click()}>{isSale ? <Download className="h-4 w-4"/> : <Upload className="h-4 w-4"/>}{isSale ? "Export" : "Import"}</Button>
          <Button variant="outline" title={`Remove row · ${shortcuts.removeRow}`} disabled={selected === null} onClick={removeSelected}><Trash2 className="h-4 w-4"/>Remove</Button>
          <Button variant="outline" title={`Refresh · ${shortcuts.refresh}`} onClick={() => { if (!lines.some(l => l.item_name.trim()) || confirm("Clear the invoice? Unsaved changes will be lost.")) reset(); }}><RefreshCw className="h-4 w-4"/>Refresh</Button>
          <Button title={`Save · ${shortcuts.save}`} onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4"/>{save.isPending ? "Saving…" : editingId ? "Update" : "Save"}</Button>
          <Button variant="outline" title={`Print · ${shortcuts.print}`} onClick={printInvoice}><Printer className="h-4 w-4"/>Print</Button>
          <Button variant="outline" asChild><Link to="/admin" onClick={e => { if (lines.some(l => l.item_name.trim()) && !confirm("Close the invoice? Unsaved changes will be lost.")) e.preventDefault(); }}><X className="h-4 w-4"/>Close</Link></Button>
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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[80dvh] overflow-auto sm:max-w-4xl"><DialogTitle>Recent {isSale ? "sales" : "purchase"} invoices</DialogTitle>
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
                  <td className="px-4 py-2 font-mono">{isSale ? <Button variant="link" className="h-auto p-0" disabled={loadingBill || save.isPending} onClick={() => void loadBill(inv.bill_no, inv.id)}>{inv.bill_no}</Button> : inv.bill_no}</td><td>{inv.bill_date}</td><td>{inv.party_name || "Walk-in"}</td>
                  <td className="capitalize">{inv.payment_mode}</td><td className="text-right">{money(inv.total_tax)}</td>
                  <td className="px-4 text-right font-semibold">{money(inv.net_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </DialogContent></Dialog>
    </div>
  );
}
