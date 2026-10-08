import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/admin/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger — BusinessDesk" },
      { name: "description", content: "Double-entry journal ledger with debit and credit lines." },
      { property: "og:title", content: "Ledger — BusinessDesk" },
      { property: "og:description", content: "Double-entry journal ledger with debit and credit lines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LedgerPage,
});

type Line = { account_id: string; debit: string; credit: string };
const EMPTY_LINE: Line = { account_id: "", debit: "", credit: "" };

function LedgerPage() {
  return (
    <AppLayout>
      <SupabaseGate>
        <LedgerInner />
      </SupabaseGate>
    </AppLayout>
  );
}

function LedgerInner() {
  const supabase = useSupabase()!;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState({ entry_date: new Date().toISOString().slice(0, 10), reference: "", description: "" });
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, code, name, type").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*, journal_lines(*, accounts(code, name))")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && totalDebit === totalCredit;

  const addEntry = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase
        .from("journal_entries")
        .insert(entry)
        .select("id")
        .single();
      if (error) throw error;
      const rows = lines
        .filter((l) => l.account_id && (Number(l.debit) || Number(l.credit)))
        .map((l) => ({
          entry_id: inserted.id,
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        }));
      const { error: lineError } = await supabase.from("journal_lines").insert(rows);
      if (lineError) throw lineError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal_entries"] });
      setEntry({ entry_date: new Date().toISOString().slice(0, 10), reference: "", description: "" });
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
      setOpen(false);
    },
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal_entries"] }),
  });

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Ledger</h1>
          <p className="text-sm text-muted-foreground">Double-entry journal</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /><span className="hidden sm:inline">New Entry</span><span className="sm:hidden">New</span></Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); addEntry.mutate(); }}>
               <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={entry.entry_date} onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input placeholder="JV-001" value={entry.reference} onChange={(e) => setEntry({ ...entry, reference: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Sales for the day" value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lines</Label>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                     <div key={i} className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_110px_110px_36px]">
                      <Select value={l.account_id} onValueChange={(v) => setLine(i, { account_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" step="0.01" min="0" placeholder="Debit" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })} />
                      <Input type="number" step="0.01" min="0" placeholder="Credit" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })} />
                      <Button type="button" variant="ghost" size="icon" disabled={lines.length <= 2} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { ...EMPTY_LINE }])}>
                  <Plus className="mr-1 h-3 w-3" /> Add line
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-md bg-muted px-4 py-2 text-sm">
                <span>Debit: <strong>{money(totalDebit)}</strong></span>
                <span>Credit: <strong>{money(totalCredit)}</strong></span>
                <span className={balanced ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>
                  {balanced ? "Balanced" : "Not balanced"}
                </span>
              </div>

              <Button type="submit" className="w-full" disabled={!balanced || addEntry.isPending}>
                {addEntry.isPending ? "Saving…" : "Post Entry"}
              </Button>
              {addEntry.isError && <p className="text-sm text-destructive">{String(addEntry.error)}</p>}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No journal entries yet.</TableCell></TableRow>
              ) : (
                entries.map((e: any) => {
                  const total = (e.journal_lines ?? []).reduce((s: number, l: any) => s + Number(l.debit ?? 0), 0);
                  const accts = (e.journal_lines ?? [])
                    .map((l: any) => l.accounts?.name)
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{e.entry_date}</TableCell>
                      <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell className="max-w-56 truncate text-sm text-muted-foreground">{accts}</TableCell>
                      <TableCell className="text-right font-semibold">{money(total)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeEntry.mutate(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
