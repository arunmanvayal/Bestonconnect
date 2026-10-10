import { gstReport, gstDetails } from "@/lib/financial-reports";
import { fetchAll } from "@/lib/data-transfer";
import { fetchSearchRecords } from "@/lib/search-data";
import { matchesSearch } from "@/lib/search";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Printer } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { fetchBalances, fetchOutstanding } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — BusinessDesk" },
      { name: "description", content: "Sales, purchase, stock, customer, vendor, debtor, creditor, expense and GST reports." },
      { property: "og:title", content: "Reports — BusinessDesk" },
      { property: "og:description", content: "Sales, purchase, stock, customer, vendor, debtor, creditor, expense and GST reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <SupabaseGate>
        <ReportsInner />
      </SupabaseGate>
    </AppLayout>
  ),
});

const TABS = [
  ["sales", "Sales"], ["purchase", "Purchase"], ["returns", "Sales Returns"], ["stock", "Stock"],
  ["customers", "Customers"], ["vendors", "Vendors"], ["debtors", "Debtors"], ["creditors", "Creditors"],
  ["expenses", "Expenses"], ["gst", "GST"], ["gst-detail", "GST Details"], ["hsn", "HSN"], ["pl", "Profit & Loss"],
] as const;
type Tab = (typeof TABS)[number][0];
type Col = { key: string; label: string; money?: boolean; num?: boolean };

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

function ReportsInner() {
  const sb = useSupabase()!;
  const [tab, setTab] = useState<Tab>("sales");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [inv, rets, prods, parties, balances, outstanding, items, journalLines, journalEntries] = await Promise.all([
        fetchSearchRecords(sb, "invoices", "bill_date").then(data => ({ data })),
        fetchSearchRecords(sb, "sales_returns", "return_date").then(data => ({ data })),
        fetchAll(sb, "products").then((data) => ({ data, error: null })),
        fetchSearchRecords(sb, "customers", "name").then(data => ({ data })),
        fetchBalances(sb),
        fetchOutstanding(sb),
        fetchSearchRecords(sb,"invoice_items","id"),
        fetchSearchRecords(sb,"journal_lines","id"),
        fetchSearchRecords(sb,"journal_entries","entry_date"),
      ]);
      return { inv: (inv.data ?? []) as any[], rets: (rets.data ?? []) as any[], prods: (prods.data ?? []) as any[], parties: (parties.data ?? []) as any[], balances, outstanding, items, journalLines, journalEntries };
    },
  });

  const report = useMemo((): { cols: Col[]; rows: any[]; totals?: Record<string, number> } => {
    if (!data) return { cols: [], rows: [] };
    const inRange = (d: string) => d >= from && d <= to;
    const inv = data.inv.filter((i) => inRange(String(i.bill_date)));
    const rets = data.rets.filter((r) => inRange(String(r.return_date)));
    const sales = inv.filter((i) => i.kind === "sale");
    const purch = inv.filter((i) => i.kind === "purchase");
    const sum = (rows: any[], keys: string[]) => Object.fromEntries(keys.map((k) => [k, rows.reduce((a, r) => a + Number(r[k] || 0), 0)]));
    const byParty = (list: any[]) => {
      const m = new Map<string, any>();
      for (const i of list) {
        const k = i.party_id || i.party_name || "Walk-in";
        const r = m.get(k) ?? { party: i.party_name || "Walk-in", bills: 0, taxable: 0, total_tax: 0, net_total: 0, credit: 0 };
        r.bills++; r.taxable += Number(i.taxable); r.total_tax += Number(i.total_tax); r.net_total += Number(i.net_total);
        if (i.payment_mode === "credit") r.credit += Number(i.net_total);
        m.set(k, r);
      }
      return [...m.values()].sort((a, b) => b.net_total - a.net_total);
    };
    const billCols: Col[] = [
      { key: "bill_date", label: "Date" }, { key: "bill_no", label: "Bill No" }, { key: "party_name", label: "Party" },
      { key: "payment_mode", label: "Mode" }, { key: "taxable", label: "Taxable", money: true }, { key: "total_tax", label: "GST", money: true }, { key: "net_total", label: "Net Total", money: true },
    ];
    switch (tab) {
      case "sales": return { cols: billCols, rows: sales, totals: sum(sales, ["taxable", "total_tax", "net_total"]) };
      case "purchase": return { cols: billCols, rows: purch, totals: sum(purch, ["taxable", "total_tax", "net_total"]) };
      case "returns": return {
        cols: [{ key: "return_date", label: "Date" }, { key: "return_no", label: "Return No" }, { key: "bill_no", label: "Bill" }, { key: "party_name", label: "Customer" }, { key: "refund_mode", label: "Refund" }, { key: "taxable", label: "Taxable", money: true }, { key: "total_tax", label: "GST", money: true }, { key: "amount", label: "Amount", money: true }],
        rows: rets, totals: sum(rets, ["taxable", "total_tax", "amount"]),
      };
      case "stock": {
        const rows = data.prods.map((p) => ({ ...p, cost_value: Number(p.quantity) * Number(p.cost_price || 0), sale_value: Number(p.quantity) * Number(p.unit_price || 0), status: Number(p.quantity) <= Number(p.reorder_level) ? "Reorder" : "OK" }));
        return { cols: [{ key: "barcode", label: "Barcode" }, { key: "name", label: "Product" }, { key: "quantity", label: "Qty", num: true }, { key: "unit", label: "Unit" }, { key: "cost_price", label: "Cost", money: true }, { key: "unit_price", label: "Sale Price", money: true }, { key: "cost_value", label: "Cost Value", money: true }, { key: "sale_value", label: "Sale Value", money: true }, { key: "status", label: "Status" }], rows, totals: sum(rows, ["quantity", "cost_value", "sale_value"]) };
      }
      case "customers": case "vendors": {
        const rows = byParty(tab === "customers" ? sales : purch);
        return { cols: [{ key: "party", label: tab === "customers" ? "Customer" : "Vendor" }, { key: "bills", label: "Bills", num: true }, { key: "taxable", label: "Taxable", money: true }, { key: "total_tax", label: "GST", money: true }, { key: "credit", label: "On Credit", money: true }, { key: "net_total", label: "Total", money: true }], rows, totals: sum(rows, ["bills", "taxable", "total_tax", "credit", "net_total"]) };
      }
      case "debtors": case "creditors": {
        const side = tab === "debtors" ? "customer" : "supplier";
        const rows = data.outstanding.rows.filter((r) => r.side === side && Math.abs(r.balance) > 0.009).map((r) => ({ ...r, phone: data.parties.find((p) => p.id === r.party_id)?.phone ?? "" })).sort((a, b) => b.balance - a.balance);
        return { cols: [{ key: "party_name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "billed", label: "Credit Billed", money: true }, { key: "settled", label: side === "customer" ? "Received" : "Paid", money: true }, { key: "balance", label: "Balance", money: true }], rows, totals: sum(rows, ["billed", "settled", "balance"]) };
      }
      case "expenses": {
        const rows = data.balances.filter((a: any) => a.type === "expense");
        return { cols: [{ key: "code", label: "Code" }, { key: "name", label: "Account" }, { key: "debit_total", label: "Debits", money: true }, { key: "credit_total", label: "Credits", money: true }, { key: "balance", label: "Balance", money: true }], rows, totals: sum(rows, ["debit_total", "credit_total", "balance"]) };
      }
      case "gst": {
        const rows = gstReport(inv, rets);
        return { cols: [{ key: "month", label: "Month" }, { key: "out_taxable", label: "Sales Taxable", money: true }, { key: "output", label: "Output GST", money: true }, { key: "ret_tax", label: "Returns GST", money: true }, { key: "in_taxable", label: "Purchase Taxable", money: true }, { key: "input", label: "Input GST", money: true }, { key: "net", label: "Net Payable", money: true }], rows, totals: sum(rows, ["out_taxable", "output", "ret_tax", "in_taxable", "input", "net"]) };
      }
      case "gst-detail": {
        const rows=gstDetails(inv,data.items,rets).bills;
        return { cols:[{key:"bill_date",label:"Date"},{key:"bill_no",label:"Bill / credit note"},{key:"party_name",label:"Party"},{key:"gstin",label:"GSTIN"},{key:"classification",label:"Type"},{key:"taxable",label:"Taxable",money:true},{key:"cgst",label:"CGST",money:true},{key:"sgst",label:"SGST",money:true},{key:"igst",label:"IGST",money:true},{key:"total_tax",label:"GST",money:true},{key:"kfc",label:"KFC",money:true},{key:"net_total",label:"Total",money:true}],rows,totals:sum(rows,["taxable","total_tax","kfc","net_total"]) };
      }
      case "hsn": {
        const rows=gstDetails(inv,data.items,[]).hsn;
        return {cols:[{key:"hsn",label:"HSN"},{key:"kind",label:"Sale / Purchase"},{key:"rate",label:"Rate",num:true},{key:"quantity",label:"Quantity",num:true},{key:"taxable",label:"Taxable",money:true},{key:"cgst",label:"CGST",money:true},{key:"sgst",label:"SGST",money:true},{key:"igst",label:"IGST",money:true},{key:"total_tax",label:"Tax",money:true}],rows,totals:sum(rows,["taxable","cgst","sgst","igst","total_tax"])};
      }
      case "pl": {
        const s = sales.reduce((a, i) => a + Number(i.taxable), 0);
        const r = rets.reduce((a, i) => a + Number(i.taxable), 0);
        const p = purch.reduce((a, i) => a + Number(i.taxable), 0);
        const periodEntries = new Set(data.journalEntries.filter(e=>inRange(String(e.entry_date))).map(e=>e.id));
        const expenseAccounts = new Set(data.balances.filter(a=>a.type === "expense" && a.code !== "5000").map(a=>a.id));
        const exp = data.journalLines.filter(l=>periodEntries.has(l.entry_id) && expenseAccounts.has(l.account_id)).reduce((sum,l)=>sum+Number(l.debit)-Number(l.credit),0);
        const rows = [
          { item: "Sales (taxable)", amount: s }, { item: "Less: Sales returns", amount: -r }, { item: "Net sales", amount: s - r },
          { item: "Less: Purchases (taxable)", amount: -p }, { item: "Gross profit", amount: s - r - p },
          { item: "Less: Other expenses (selected period)", amount: -exp }, { item: "Net profit (approx.)", amount: s - r - p - exp },
        ];
        return { cols: [{ key: "item", label: "Particulars" }, { key: "amount", label: "Amount", money: true }], rows };
      }
    }
  }, [data, tab, from, to]);

  const filteredRows = report.rows.filter(row => matchesSearch(search, ...report.cols.map(col => row[col.key])));
  const filteredTotals = report.totals ? Object.fromEntries(Object.keys(report.totals).map(key => [key, filteredRows.reduce((sum, row) => sum + Number(row[key] || 0), 0)])) : undefined;
  const csv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [report.cols.map((c) => esc(c.label)).join(","), ...filteredRows.map((r) => report.cols.map((c) => esc(c.money ? Number(r[c.key] || 0).toFixed(2) : r[c.key])).join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `${tab}-report-${from}-to-${to}.csv`; a.click();
  };
  const dated = !["stock", "debtors", "creditors", "expenses"].includes(tab);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><BarChart3 className="h-5 w-5" /></div>
          <div className="min-w-0"><h1 className="text-xl font-bold sm:text-2xl">Reports</h1><p className="truncate text-xs text-muted-foreground">All business reports in one place</p></div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={csv}><Download className="h-4 w-4" /><span className="hidden sm:inline">Export</span></Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /><span className="hidden sm:inline">Print</span></Button>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 print:hidden">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === k ? "bg-primary text-primary-foreground shadow" : "bg-card text-muted-foreground hover:bg-muted"}`}>{label}</button>
        ))}
      </div>

      {dated && (
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <label className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">From</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">To</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <Button variant="ghost" size="sm" onClick={() => { setFrom("2000-01-01"); setTo(today()); }}>All time</Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">Reports could not be loaded. Your saved records have not been changed.</p>}
      <Input className="print:hidden" aria-label="Search report" placeholder="Search this report" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
        <div className="border-b border-border px-4 py-3 font-semibold">{TABS.find((t) => t[0] === tab)?.[1]} report {dated && <span className="text-sm font-normal text-muted-foreground">· {from} to {to}</span>}</div>
        <div className="overflow-x-auto">
          {isLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : filteredRows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{search.trim() ? "No matching records." : "No data for this period."}</p> : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground"><tr>{report.cols.map((c) => <th key={c.key} className={`px-4 py-2 font-medium ${c.money || c.num ? "text-right" : ""}`}>{c.label}</th>)}</tr></thead>
              <tbody>{filteredRows.map((r, i) => (
                <tr key={r.id ?? r.key ?? i} className="border-t border-border">
                  {report.cols.map((c) => <td key={c.key} className={`px-4 py-2 ${c.money || c.num ? "text-right tabular-nums" : ""} ${c.key === "payment_mode" || c.key === "refund_mode" ? "capitalize" : ""}`}>{c.money ? money(Number(r[c.key] || 0)) : c.num ? Number(r[c.key] || 0) : r[c.key] || "—"}</td>)}
                </tr>
              ))}</tbody>
              {filteredTotals && (
                <tfoot className="border-t-2 border-border bg-muted/40 font-semibold"><tr>{report.cols.map((c, i) => <td key={c.key} className={`px-4 py-2 ${c.money || c.num ? "text-right tabular-nums" : ""}`}>{i === 0 ? "Total" : c.key in filteredTotals ? (c.money ? money(filteredTotals[c.key] ?? 0) : filteredTotals[c.key]) : ""}</td>)}</tr></tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
