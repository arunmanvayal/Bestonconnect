import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { fetchOutstanding, postPayment, INVOICE_QUERY_KEYS, type PayKind } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspaceCommands, useWorkspacePreferences } from "@/lib/workspace-preferences";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Receipts & Payments — BusinessDesk" },
      { name: "description", content: "Record customer receipts and supplier payments with outstanding balances and full history." },
      { property: "og:title", content: "Receipts & Payments — BusinessDesk" },
      { property: "og:description", content: "Record customer receipts and supplier payments with outstanding balances and full history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <SupabaseGate>
        <PaymentsInner />
      </SupabaseGate>
    </AppLayout>
  ),
});

const today = () => new Date().toISOString().slice(0, 10);

function PaymentsInner() {
  const sb = useSupabase()!;
  const qc = useQueryClient();
  const [kind, setKind] = useState<PayKind>("receipt");
  const [form, setForm] = useState({ partyKey: "", party_name: "", amount: "", mode: "cash", pay_date: today(), reference: "", notes: "" });
  const [historyParty, setHistoryParty] = useState<string>("all");
  const { shortcuts } = useWorkspacePreferences();

  const { data, isLoading } = useQuery({ queryKey: ["outstanding"], queryFn: () => fetchOutstanding(sb) });
  const { data: parties = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await sb.from("customers").select("id, name, party_type").order("name")).data ?? [],
  });

  const side = kind === "receipt" ? "customer" : "supplier";
  const outstanding = (data?.rows ?? []).filter((r) => r.side === side);
  const selected = outstanding.find((r) => r.key === form.partyKey);

  const partyOptions = useMemo(() => {
    const opts = outstanding.map((r) => ({ key: r.key, id: r.party_id, name: r.party_name, balance: r.balance }));
    for (const p of parties as any[]) {
      const isSide = side === "customer" ? p.party_type !== "supplier" : p.party_type === "supplier";
      if (isSide && !opts.some((o) => o.id === p.id)) opts.push({ key: `${side}:${p.id}`, id: p.id, name: p.name, balance: 0 });
    }
    return opts.sort((a, b) => b.balance - a.balance);
  }, [outstanding, parties, side]);

  const save = useMutation({
    mutationFn: async () => {
      const opt = partyOptions.find((o) => o.key === form.partyKey);
      const count = (data?.payments ?? []).filter((p: any) => p.kind === kind).length + 1;
      await postPayment(sb, {
        kind, voucher_no: `${kind === "receipt" ? "RV" : "PV"}-${String(count).padStart(4, "0")}`,
        pay_date: form.pay_date, party_id: opt?.id ?? null, party_name: opt?.name ?? "",
        amount: Number(form.amount), mode: form.mode, reference: form.reference, notes: form.notes,
      });
    },
    onSuccess: () => {
      INVOICE_QUERY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      setForm({ ...form, partyKey: "", amount: "", reference: "", notes: "" });
    },
  });
  useWorkspaceCommands({ save: () => save.mutate(), refresh: () => setForm({ partyKey: "", party_name: "", amount: "", mode: "cash", pay_date: today(), reference: "", notes: "" }) });

  const history = (data?.payments ?? []).filter((p: any) => {
    if (historyParty === "all") return true;
    const r = data!.rows.find((x) => x.key === historyParty);
    return r && (p.party_id ? p.party_id === r.party_id : p.party_name === r.party_name) && (p.kind === "receipt") === (r.side === "customer");
  });
  const allRows = data?.rows ?? [];
  const totRecv = allRows.filter((r) => r.side === "customer").reduce((s, r) => s + r.balance, 0);
  const totPay = allRows.filter((r) => r.side === "supplier").reduce((s, r) => s + r.balance, 0);

  return (
    <div className="entry-workspace space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Receipts & Payments</h1>
        <p className="text-sm text-muted-foreground">Collect from customers, pay suppliers, track balances</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">To receive from customers</p><p className="text-2xl font-bold">{money(totRecv)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">To pay suppliers</p><p className="text-2xl font-bold">{money(totPay)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <CardTitle>New {kind === "receipt" ? "Receipt" : "Payment"}</CardTitle>
          <Tabs value={kind} onValueChange={(v) => { setKind(v as PayKind); setForm({ ...form, partyKey: "" }); }}>
            <TabsList className="grid h-auto grid-cols-2">
              <TabsTrigger className="whitespace-normal text-center" value="receipt">Receipt (from customer)</TabsTrigger>
              <TabsTrigger className="whitespace-normal text-center" value="payment">Payment (to supplier)</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="space-y-2 md:col-span-2">
              <Label>{kind === "receipt" ? "Customer" : "Supplier"} *</Label>
              <Select value={form.partyKey} onValueChange={(v) => {
                const o = partyOptions.find((x) => x.key === v);
                setForm({ ...form, partyKey: v, amount: o && o.balance > 0 ? String(o.balance) : form.amount });
              }}>
                <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>
                  {partyOptions.length === 0 && <div className="p-2 text-sm text-muted-foreground">No parties yet</div>}
                  {partyOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.name}{o.balance !== 0 ? ` — due ${money(o.balance)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && <p className="text-xs text-muted-foreground">Billed on credit {money(selected.billed)} · Settled {money(selected.settled)} · Balance {money(selected.balance)}</p>}
            </div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem><SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Reference / Cheque no.</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
             <div className="flex items-end"><Button type="submit" title={`Save · ${shortcuts.save}`} className="w-full" disabled={save.isPending}>{save.isPending ? "Saving…" : `Save ${kind === "receipt" ? "Receipt" : "Payment"}`}</Button></div>
            {save.isError && <p className="text-sm text-destructive md:col-span-3">{(save.error as Error).message}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Outstanding balances</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Party</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Credit billed</TableHead><TableHead className="text-right">Settled</TableHead><TableHead className="text-right">Balance</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
                : allRows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No credit bills yet.</TableCell></TableRow>
                : allRows.sort((a, b) => b.balance - a.balance).map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.party_name}</TableCell>
                    <TableCell><Badge variant="secondary">{r.side === "customer" ? "Customer" : "Supplier"}</Badge></TableCell>
                    <TableCell className="text-right">{money(r.billed)}</TableCell>
                    <TableCell className="text-right">{money(r.settled)}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.balance > 0 ? "text-destructive" : ""}`}>{money(r.balance)}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setHistoryParty(r.key)}>History</Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Receipt & payment history{historyParty !== "all" && ` — ${allRows.find((r) => r.key === historyParty)?.party_name ?? ""}`}</CardTitle>
          {historyParty !== "all" && <Button size="sm" variant="outline" onClick={() => setHistoryParty("all")}>Show all</Button>}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Type</TableHead><TableHead>Party</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No entries yet.</TableCell></TableRow>
                : history.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.pay_date}</TableCell>
                    <TableCell className="font-mono text-sm">{p.voucher_no}</TableCell>
                    <TableCell><Badge variant={p.kind === "receipt" ? "default" : "secondary"}>{p.kind === "receipt" ? "Receipt" : "Payment"}</Badge></TableCell>
                    <TableCell>{p.party_name}</TableCell>
                    <TableCell className="capitalize">{p.mode}</TableCell>
                    <TableCell className="text-muted-foreground">{p.reference || p.notes}</TableCell>
                    <TableCell className="text-right font-semibold">{money(p.amount)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
