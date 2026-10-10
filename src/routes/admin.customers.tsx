import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Pencil } from "lucide-react";
import { fetchOutstanding } from "@/lib/books";
import { toast } from "sonner";
import { money } from "@/components/SupabaseGate";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { matchesSearch } from "@/lib/search";
import { fetchSearchRecords } from "@/lib/search-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — BusinessDesk" },
      { name: "description", content: "Manage your CRM: customers, contacts and companies." },
      { property: "og:title", content: "Customers — BusinessDesk" },
      { property: "og:description", content: "Manage your CRM: customers, contacts and companies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

const EMPTY = { name: "", company: "", email: "", phone: "", address: "", notes: "", gstin: "", party_type: "customer", opening_balance: "0" };

function CustomersPage() {
  return (
    <AppLayout>
      <SupabaseGate>
        <CustomersInner />
      </SupabaseGate>
    </AppLayout>
  );
}

function CustomersInner() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<any | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      if (!supabase) throw new Error("Connection unavailable");
      return fetchSearchRecords(supabase, "customers", "name");
    },
  });

  const addCustomer = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Connection unavailable");
      const payload = { ...form, name: form.name.trim(), opening_balance: Number(form.opening_balance) };
      if (!payload.name || !Number.isFinite(payload.opening_balance)) throw new Error("Enter valid name and opening balance");
      const { error } = await (editId ? supabase.from("customers").update(payload).eq("id",editId) : supabase.from("customers").insert(payload));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setForm(EMPTY);
      setOpen(false);
    },
  });

  const removeCustomer = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Connection unavailable");
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (error: any) => toast.error(error.message || "Party cannot be deleted"),
  });

  const term = q.toLowerCase().trim();
  const shown = customers.filter((c: any) => matchesSearch(q, c.name, c.code, c.company, c.email, c.phone, c.address, c.gstin));

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Your CRM contact list</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); setForm(EMPTY); }}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add Customer</span><span className="sm:hidden">Add</span></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit party" : "New party"}</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); addCustomer.mutate(); }}
            >
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input required value={form.name} onChange={set("name")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input value={form.company} onChange={set("company")} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={set("phone")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={set("email")} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={set("address")} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={set("notes")} />
              </div>
              <div className="grid grid-cols-2 gap-3"><label className="space-y-2"><Label>Type</Label><select aria-label="Party type" className="h-10 w-full border border-input bg-background px-2" value={form.party_type} onChange={e => setForm(f=>({...f,party_type:e.target.value}))}><option value="customer">Customer</option><option value="supplier">Supplier</option></select></label><label className="space-y-2"><Label>Opening balance</Label><Input aria-label="Opening balance" type="number" value={form.opening_balance} onChange={set("opening_balance")}/></label></div>
              <label className="space-y-2"><Label>GSTIN</Label><Input value={form.gstin} onChange={set("gstin")}/></label>
              <Button type="submit" className="w-full" disabled={addCustomer.isPending}>
                {addCustomer.isPending ? "Saving…" : "Save Customer"}
              </Button>
              {addCustomer.isError && (
                <p className="text-sm text-destructive">{String(addCustomer.error)}</p>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, company, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : shown.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{term ? "No customers match your search." : "No customers yet — add your first one."}</TableCell></TableRow>
              ) : (
                shown.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSel(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.company}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => { setEditId(c.id); setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(key=>[key,String(c[key] ?? EMPTY[key as keyof typeof EMPTY])])) }); setOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${c.name}?`)) removeCustomer.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] w-[calc(100vw-1.5rem)] max-w-3xl overflow-x-hidden overflow-y-auto">
          {sel && <CustomerDetail c={sel} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerDetail({ c }: { c: any }) {
  const sb = useSupabase();
  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", c.id],
    queryFn: async () => {
      if (!sb) throw new Error("Connection unavailable");
      const [inv, pay, ret, current, outstanding] = await Promise.all([
        fetchSearchRecords(sb,"invoices","bill_date"), fetchSearchRecords(sb,"payments","pay_date"), fetchSearchRecords(sb,"sales_returns","return_date"), sb.from("customers").select("*").eq("id",c.id).single(), fetchOutstanding(sb),
      ]);
      if (current.error) throw current.error;
      const party = current.data;
      const match = (record: any) => record.party_id === c.id || (!record.party_id && record.party_name?.trim().toLowerCase() === party.name?.trim().toLowerCase());
      return { party, invoices: inv.filter(i=>match(i) && i.kind === (party.party_type === "supplier" ? "purchase" : "sale")), payments: pay.filter(p=>match(p) && p.kind === (party.party_type === "supplier" ? "payment" : "receipt")), returns: party.party_type === "supplier" ? [] : ret.filter(match), balance: outstanding.rows.find(r=>r.party_id===c.id)?.balance ?? 0 };

    },
  });
  c = data?.party ?? c;
  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const returns = data?.returns ?? [];
  const returnedAll = returns.reduce((a, r) => a + Number(r.amount), 0);
  const returnedCredit = returns.filter((r) => r.refund_mode === "credit").reduce((a, r) => a + Number(r.amount), 0);
  const sales = invoices.filter((i) => i.kind === "sale").reduce((a, i) => a + Number(i.net_total), 0);
  const purchases = invoices.filter((i) => i.kind === "purchase").reduce((a, i) => a + Number(i.net_total), 0);
  const creditSale = invoices.filter((i) => i.kind === "sale" && i.payment_mode === "credit").reduce((a, i) => a + Number(i.net_total), 0);
  const creditPurch = invoices.filter((i) => i.kind === "purchase" && i.payment_mode === "credit").reduce((a, i) => a + Number(i.net_total), 0);
  const received = payments.filter((p) => p.kind === "receipt").reduce((a, p) => a + Number(p.amount), 0);
  const paid = payments.filter((p) => p.kind === "payment").reduce((a, p) => a + Number(p.amount), 0);
  const tx = [
    ...invoices.map((i) => ({ id: "i" + i.id, date: i.bill_date, type: i.kind === "sale" ? "Sale" : "Purchase", ref: i.bill_no, mode: i.payment_mode, amount: Number(i.net_total) })),
    ...payments.map((p) => ({ id: "p" + p.id, date: p.pay_date, type: p.kind === "receipt" ? "Receipt" : "Payment", ref: p.voucher_no, mode: p.mode, amount: Number(p.amount) })),
    ...returns.map((r) => ({ id: "r" + r.id, date: r.return_date, type: "Sales return", ref: r.return_no, mode: r.refund_mode === "credit" ? "balance" : r.refund_mode, amount: -Number(r.amount) })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const stat = (label: string, v: number) => (
    <div className="min-w-0 rounded-xl border border-border/70 bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate font-display text-base font-bold tabular-nums sm:text-lg">{money(v)}</p></div>
  );
  return (
    <div className="min-w-0 space-y-5">
      <DialogHeader><DialogTitle>{c.name}</DialogTitle></DialogHeader>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {[["Company", c.company], ["Phone", c.phone], ["Email", c.email], ["Type", c.party_type ?? "customer"], ["Address", c.address], ["Notes", c.notes]].map(([k, v]) => (
          <div key={k}><span className="text-muted-foreground">{k}: </span><span className="font-medium">{v || "—"}</span></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stat("Total sales", sales)}{stat("Received", received)}{stat("Owes you", c.party_type === "supplier" ? 0 : Math.max(0, data?.balance ?? Number(c.opening_balance || 0)))}
        {stat("Total purchases", purchases)}{stat("Paid", paid)}{stat("You owe", c.party_type === "supplier" ? Math.max(0, data?.balance ?? Number(c.opening_balance || 0)) : 0)}{stat("Returns", returnedAll)}{stat("Opening balance", Number(c.opening_balance || 0))}{stat("Advance", Math.max(0,-(data?.balance || 0)))}
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Transactions</h3>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : tx.length === 0 ? <p className="text-sm text-muted-foreground">No transactions yet.</p> : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-muted/60 text-left text-muted-foreground"><tr><th className="px-3 py-2">Date</th><th>Type</th><th>Ref</th><th>Mode</th><th className="px-3 text-right">Amount</th></tr></thead>
              <tbody>{tx.map((t) => (
                <tr key={t.id} className="border-t border-border"><td className="px-3 py-2">{t.date}</td><td>{t.type}</td><td className="font-mono">{t.ref}</td><td className="capitalize">{t.mode}</td><td className="px-3 text-right font-semibold tabular-nums">{money(t.amount)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
