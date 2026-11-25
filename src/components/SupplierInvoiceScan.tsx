import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, ChevronsUpDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSupabase } from "@/lib/supabase";
import { extractSupplierInvoice, type ExtractedInvoice, type ExtractedItem } from "@/lib/supplier-invoice.functions";
import { rankedSearch } from "@/lib/search";

type Product = { id: string; name: string; sku?: string | null; barcode?: string | null };
export type ScanRow = ExtractedItem & { product_id: string | null };

const toDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

function ProductMatchPicker({ products, value, onChange }: { products: Product[]; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = products.find(product => product.id === value);
  const matches = rankedSearch(products, query, product => [product.name, product.sku, product.barcode], 50);

  const choose = (id: string | null) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  return <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(""); }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm" aria-label="Match product" aria-expanded={open} className="h-8 w-44 justify-between px-2 text-xs font-normal">
        <span className="min-w-0 truncate">{selected?.name ?? "— New / unmatched —"}</span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80 p-0">
      <Command shouldFilter={false}>
        <CommandInput aria-label="Search products to match" placeholder="Search name, item code or barcode…" value={query} onValueChange={setQuery} />
        <CommandList className="max-h-64">
          <CommandGroup>
            <CommandItem value="unmatched" onSelect={() => choose(null)} className="justify-between">
              <span>— New / unmatched —</span>
              {!value && <Check className="h-4 w-4" />}
            </CommandItem>
            {matches.map(product => <CommandItem key={product.id} value={`${product.name} ${product.sku ?? ""} ${product.barcode ?? ""}`} onSelect={() => choose(product.id)} className="justify-between gap-3">
              <span className="min-w-0 flex-1 truncate">{product.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{product.sku || product.barcode || ""}</span>
              {value === product.id && <Check className="h-4 w-4 shrink-0" />}
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
        {matches.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No matching products.</p>}
      </Command>
    </PopoverContent>
  </Popover>;
}

export function SupplierInvoiceScan({ products, onApply }: { products: Product[]; onApply: (rows: ScanRow[], meta: Omit<ExtractedInvoice, "items">) => void }) {
  const sb = useSupabase();
  const extract = useServerFn(extractSupplierInvoice);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [meta, setMeta] = useState<Omit<ExtractedInvoice, "items">>({ supplier: null, bill_no: null, bill_date: null });
  const [rows, setRows] = useState<ScanRow[]>([]);

  const match = (name: string) => rankedSearch(products, name, product => [product.name, product.sku], 1)[0]?.id ?? null;

  async function upload(file: File) {
    if (!sb) return;
    setBusy(true); setRows([]);
    try {
      const dataUrl = await toDataUrl(file);
      setPreview(file.type.startsWith("image/") ? dataUrl : "");
      const { data: s } = await sb.auth.getSession();
      const r = await extract({ data: { accessToken: s.session?.access_token ?? "", dataUrl, mimeType: file.type } });
      if (!r.ok) { toast.error(r.error); return; }
      const { items, ...m } = r.invoice; setMeta(m);
      setRows(items.map(i => ({ ...i, product_id: match(i.name) })));
      if (!items.length) toast.info("No items found on this invoice");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  }

  const edit = (i: number, patch: Partial<ScanRow>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));

  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><Camera className="h-4 w-4" />Scan Bill</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto">
        <DialogTitle>Scan supplier invoice</DialogTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Input type="file" accept="image/*,application/pdf" capture="environment" className="max-w-xs" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          {busy && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading invoice…</span>}
          {(meta.supplier || meta.bill_no) && <span className="text-sm">Supplier: <b>{meta.supplier ?? "—"}</b> · Bill: <b>{meta.bill_no ?? "—"}</b> · {meta.bill_date ?? ""}</span>}
        </div>
        {rows.length > 0 && <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
          {preview ? <img src={preview} alt="Uploaded supplier invoice" className="max-h-[60vh] w-full rounded border border-border object-contain" /> : <div />}
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-primary text-primary-foreground"><tr>{["Item on bill", "Match product", "Qty", "Rate", "GST %", "MRP", ""].map(h => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border">
                <td className="p-1"><Input className="h-8 text-xs" value={r.name} onChange={e => edit(i, { name: e.target.value })} /></td>
                <td className="p-1"><ProductMatchPicker products={products} value={r.product_id} onChange={product_id => edit(i, { product_id })} /></td>
                {(["quantity", "rate", "gst_rate", "mrp"] as const).map(k => <td key={k} className="p-1"><Input type="number" className="h-8 w-20 text-right text-xs" value={r[k] ?? ""} onChange={e => edit(i, { [k]: e.target.value === "" ? null : Number(e.target.value) } as any)} /></td>)}
                <td className="p-1"><Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>)}</tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Check every line against the photo. Nothing is saved until you press Save on the purchase bill.</p>
          </div>
        </div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!rows.length} onClick={() => { onApply(rows, meta); setOpen(false); setRows([]); setPreview(""); }}>Add to purchase draft</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
