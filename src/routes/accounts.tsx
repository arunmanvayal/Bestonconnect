import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { fetchBalances } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Chart of Accounts — BusinessDesk" },
      { name: "description", content: "Bookkeeping chart of accounts: assets, liabilities, equity, income and expenses." },
      { property: "og:title", content: "Chart of Accounts — BusinessDesk" },
      { property: "og:description", content: "Bookkeeping chart of accounts: assets, liabilities, equity, income and expenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountsPage,
});

const TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
type AccountType = (typeof TYPES)[number];

const TYPE_COLORS: Record<AccountType, string> = {
  asset: "bg-emerald-100 text-emerald-800",
  liability: "bg-red-100 text-red-800",
  equity: "bg-blue-100 text-blue-800",
  income: "bg-amber-100 text-amber-800",
  expense: "bg-purple-100 text-purple-800",
};

function AccountsPage() {
  return (
    <AppLayout>
      <SupabaseGate>
        <AccountsInner />
      </SupabaseGate>
    </AppLayout>
  );
}

function AccountsInner() {
  const supabase = useSupabase()!;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "asset" as AccountType, opening_balance: "0" });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return fetchBalances(supabase);
    },
  });

  const addAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounts").insert({
        code: form.code,
        name: form.name,
        type: form.type,
        opening_balance: Number(form.opening_balance) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setForm({ code: "", name: "", type: "asset", opening_balance: "0" });
      setOpen(false);
    },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Bookkeeping account heads</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); addAccount.mutate(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input required placeholder="1001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input required placeholder="Cash in Hand" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={addAccount.isPending}>
                {addAccount.isPending ? "Saving…" : "Save Account"}
              </Button>
              {addAccount.isError && <p className="text-sm text-destructive">{String(addAccount.error)}</p>}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : accounts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No accounts yet — create cash, bank, sales and expense accounts.</TableCell></TableRow>
              ) : (
                accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.code}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`capitalize ${TYPE_COLORS[a.type as AccountType] ?? ""}`}>{a.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{money(a.opening_balance)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(a.balance)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeAccount.mutate(a.id)}>
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
    </div>
  );
}
