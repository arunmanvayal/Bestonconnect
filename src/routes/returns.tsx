import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Undo2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { loadReturnable, postSalesReturn, type ReturnLine } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Sales Returns — BusinessDesk" },
      { name: "description", content: "Return sold items partly or fully, restock them and reduce the customer's balance." },
      { property: "og:title", content: "Sales Returns — BusinessDesk" },
      { property: "og:description", content: "Return sold items partly or fully, restock them and reduce the customer's balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <SupabaseGate>
        <ReturnsInner />
      </SupabaseGate>
    </AppLayout>
  ),
});

const today = () => new Date().toISOString().slice(0, 10);
const selectCls = "h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function ReturnsInner() {
  const sb = useSupabase()!;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [inv, setInv] = useState<any | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState("credit");
  const [reason, setReason] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", "sale", "all"],
    queryFn: async () => (await sb.from("invoices").select("*").eq("kind", "sale").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: returns = [], error: retErr } = useQuery({
    queryKey: ["returns"],
    queryFn: async () => {
      const { data, error } = await sb.from("sales_returns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const term = q.toLowerCase().trim();
  const found = invoices.filter((i: any) => !term || String(i.bill_no).toLowerCase().includes(term) || String(i.party_name).toLowerCase().includes(term)).slice(0, 12);

  const openInvoice = async (i: any) => {
    setInv(i);
    setMode(i.payment_mode === "credit" ? "credit" : i.payment_mode === "cash" ? "cash" : "bank");
    try { setLines(await loadReturnable(sb, i.id)); } catch (e: any) { toast.error(e.message); }
  };

  const total = useMemo(() => lines.reduce((a, l) => a + (l.unitTaxable + l.unitTax) * l.qty, 0), [lines]);
  const setQty = (idx: number, v: number) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, qty: Math.max(0, Math.min(v, l.sold - l.returned)) } : l)));

  const save = useMutation({
    mutationFn: () => postSalesReturn(sb, { invoice: inv, return_no: `SR-${String(returns.length + 1).padStart(4, "0")}`, return_date: date, refund_mode: mode, reason, lines }),
    onSuccess: (amt) => {
      toast.success(`Return of ${money(amt)} saved — stock and customer balance updated`);
      qc.invalidateQueries();
      setInv(null); setLines([]); setReason("");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save return"),
  });

  if (retErr) {
    return (
      <div className="max-w-lg rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm">
        <p className="font-semibold">Sales return tables not found</p>
        <p className="mt-2 text-muted-foreground">Open the Setup page, copy the script and run it again in your Supabase SQL editor. It's safe to re-run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Undo2 className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-bold sm:text-2xl">Sales Returns</h1><p className="text-xs text-muted-foreground">Return items partly or fully — stock and customer balance update automatically</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">1. Find the sale bill</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Bill no or customer name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {found.length === 0 && <p className="text-sm text-muted-foreground">No sale bills found.</p>}
              {found.map((i: any) => (
                <button key={i.id} onClick={() => openInvoice(i)} className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${inv?.id === i.id ? "bg-primary/10" : "hover:bg-muted"}`}>
                  <span className="min-w-0"><span className="block font-mono font-medium">{i.bill_no}</span><span className="block truncate text-xs text-muted-foreground">{i.party_name || "Walk-in"} · {i.bill_date} · {i.payment_mode}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums">{money(i.net_total)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. Choose items to return {inv && <span className="font-mono text-muted-foreground">— {inv.bill_no}</span>}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!inv ? <p className="text-sm text-muted-foreground">Pick a bill on the left.</p> : (
              <>
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-muted/60 text-left text-muted-foreground"><tr><th className="px-3 py-2">Item</th><th className="text-right">Sold</th><th className="text-right">Returned</th><th className="px-2 text-right">Return qty</th><th className="px-3 text-right">Amount</th></tr></thead>
                    <tbody>{lines.map((l, idx) => {
                      const left = l.sold - l.returned;
                      return (
                        <tr key={l.invoice_item_id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{l.item_name}</td>
                          <td className="text-right tabular-nums">{l.sold}</td>
                          <td className="text-right tabular-nums text-muted-foreground">{l.returned}</td>
                          <td className="px-2 py-1">
                            <div className="flex items-center justify-end gap-1">
                              <Input type="number" className="h-8 w-20 text-right" disabled={left <= 0} value={l.qty || ""} onChange={(e) => setQty(idx, Number(e.target.value) || 0)} />
                              <Button size="sm" variant="ghost" disabled={left <= 0} onClick={() => setQty(idx, left)}>All</Button>
                            </div>
                          </td>
                          <td className="px-3 text-right font-semibold tabular-nums">{money((l.unitTaxable + l.unitTax) * l.qty)}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">Return date</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                  <label className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">Refund as</span>
                    <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                      <option value="credit">Reduce customer balance</option><option value="cash">Cash refund</option><option value="bank">Bank / UPI refund</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm"><span className="text-xs text-muted-foreground">Reason</span><Input value={reason} placeholder="Damaged, wrong item…" onChange={(e) => setReason(e.target.value)} /></label>
                </div>
                <div className="sticky bottom-20 flex items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:bottom-4">
                  <div><p className="text-xs text-muted-foreground">Return total (incl. GST)</p><p className="font-display text-xl font-bold tabular-nums">{money(total)}</p></div>
                  <Button className="ml-auto" disabled={save.isPending || total <= 0} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save Return"}</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Return history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {returns.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No returns yet.</p> : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="px-4 py-2">Return No</th><th>Date</th><th>Bill</th><th>Customer</th><th>Refund</th><th>Reason</th><th className="px-4 text-right">Amount</th></tr></thead>
              <tbody>{returns.map((r) => (
                <tr key={r.id} className="border-t border-border"><td className="px-4 py-2 font-mono">{r.return_no}</td><td>{r.return_date}</td><td className="font-mono">{r.bill_no}</td><td>{r.party_name || "Walk-in"}</td><td className="capitalize">{r.refund_mode === "credit" ? "Balance reduced" : r.refund_mode}</td><td className="text-muted-foreground">{r.reason}</td><td className="px-4 text-right font-semibold tabular-nums">{money(r.amount)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
