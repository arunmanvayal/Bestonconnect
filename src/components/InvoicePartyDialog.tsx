import { useRef, useState } from "react";
import { Plus, Save, Search } from "lucide-react";
import type { Kind } from "@/lib/books";
import { EMPTY_PARTY, invoicePartyType, type InvoiceParty, type PartyDraft } from "@/lib/invoice-party";
import { matchesSearch } from "@/lib/search";
import { useWorkspaceCommands } from "@/lib/workspace-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; kind: Kind; parties: InvoiceParty[]; initialName: string; onSelect: (party: InvoiceParty) => void; onSave: (draft: PartyDraft) => Promise<void> };

export function InvoicePartyDialog({ open, onOpenChange, kind, parties, initialName, onSelect, onSave }: Props) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<PartyDraft>({ ...EMPTY_PARTY });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const partyType = invoicePartyType(kind);
  const label = partyType === "supplier" ? "Supplier" : "Customer";
  const rows = parties.filter(p => (p.party_type ?? "customer") === partyType && matchesSearch(query, p.name, p.code, p.company, p.phone, p.email, p.address, p.gstin, p.area));
  useWorkspaceCommands({ save: () => { if (open && creating && !busy) formRef.current?.requestSubmit(); } });

  const submit = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await onSave(draft);
      setDraft({ ...EMPTY_PARTY }); setCreating(false); setQuery("");
    } catch (e) { setError(e instanceof Error ? e.message : `Could not save ${partyType}.`); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>{creating ? `New ${label}` : `Select ${label}`}</DialogTitle></DialogHeader>
      {!creating ? <>
        <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input aria-label={`Search ${partyType}s`} placeholder={`Search ${partyType}s`} className="pl-8" value={query} onChange={e => setQuery(e.target.value)}/></div><Button onClick={() => { setCreating(true); setError(""); setDraft(previous => previous.name ? previous : { ...previous, name: initialName }); }}><Plus className="h-4 w-4"/>Add {label}</Button></div>
        <div className="max-h-80 overflow-auto divide-y divide-border border border-border">
          {rows.map(p => <Button key={p.id} variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-3 text-left" onClick={() => onSelect(p)}><span className="min-w-0"><span className="block break-words font-semibold">{p.name}</span><span className="block break-words text-xs text-muted-foreground">{[p.phone || p.contact_no, p.company, p.address].filter(Boolean).join(" · ")}</span></span></Button>)}
          {!rows.length && <p className="p-4 text-sm text-muted-foreground">No {partyType}s found.</p>}
        </div>
      </> : <form ref={formRef} onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {([ ["name", "Name", "text"], ["code", "Code", "text"], ["company", "Company", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["gstin", "GSTIN", "text"], ["area", "Area", "text"] ] as const).map(([key, text, type]) => <label key={key} className="space-y-1 text-xs"><span>{text}{key === "name" ? " *" : ""}</span><Input autoFocus={key === "name"} aria-label={`${label} ${text}`} required={key === "name"} type={type} value={draft[key]} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} disabled={busy}/></label>)}
          {([ ["address", "Address"], ["notes", "Notes"] ] as const).map(([key, text]) => <label key={key} className="space-y-1 text-xs sm:col-span-2"><span>{text}</span><textarea aria-label={`${label} ${text}`} className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2" value={draft[key]} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} disabled={busy}/></label>)}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Back</Button><Button type="submit" disabled={busy}><Save className="h-4 w-4"/>{busy ? "Saving…" : `Save ${label}`}</Button></div>
      </form>}
    </DialogContent>
  </Dialog>;
}