import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { SupabaseGate } from "@/components/SupabaseGate";
import { useActiveCompany } from "@/lib/company";
import { code128 } from "@/lib/code128";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_LAYOUT, LAYOUT_KEY, fitLabels, type LabelLayout } from "@/lib/barcode-layout";

export type BarcodeLabel = { barcode: string; name: string; mrp: number; price: number; copies: number };
export const BARCODE_KEY = "barcode-print-labels";

export const Route = createFileRoute("/admin/barcodes")({
  head: () => ({ meta: [
    { title: "Print Barcode Labels — Bestonconnect" },
    { name: "description", content: "A4 sheet of product barcode labels with price and MRP." },
    { property: "og:title", content: "Print Barcode Labels — Bestonconnect" },
    { property: "og:description", content: "A4 sheet of product barcode labels with price and MRP." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <div className="min-h-screen bg-muted/50 px-3 py-6 print:bg-transparent print:p-0"><SupabaseGate><Labels /></SupabaseGate></div>,
});

function Bars({ value }: { value: string }) {
  const widths = code128(value);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = 0;
  return <svg viewBox={`0 0 ${total} 30`} preserveAspectRatio="none" className="h-[9mm] w-full">
    {widths.map((w, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} width={w} height={30} className="fill-foreground" /> : null; x += w; return r; })}
  </svg>;
}

const fmt = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

const FIELDS: Array<[keyof LabelLayout, string]> = [["width", "Label width"], ["height", "Label height"], ["gapX", "Gap across"], ["gapY", "Gap down"], ["marginTop", "Top margin"], ["marginLeft", "Left margin"]];

function Labels() {
  const { data: company } = useActiveCompany();
  const [labels, setLabels] = useState<BarcodeLabel[] | null>(null);
  const [layout, setLayout] = useState<LabelLayout>(DEFAULT_LAYOUT);
  const [outlines, setOutlines] = useState(true);
  useEffect(() => {
    try { setLabels(JSON.parse(localStorage.getItem(BARCODE_KEY) || "[]")); } catch { setLabels([]); }
    try { const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null"); if (saved) setLayout({ ...DEFAULT_LAYOUT, ...saved }); } catch { /* ignore */ }
  }, []);
  const update = (k: keyof LabelLayout, v: number) => setLayout(l => { const n = { ...l, [k]: Math.max(0, v || 0) }; localStorage.setItem(LAYOUT_KEY, JSON.stringify(n)); return n; });
  if (!labels) return null;
  const { cols, rows, perSheet } = fitLabels(layout);
  const all = labels.flatMap(l => Array.from({ length: Math.max(0, Math.floor(l.copies)) }, () => l));
  const pages: BarcodeLabel[][] = [];
  if (perSheet > 0) for (let i = 0; i < all.length; i += perSheet) pages.push(all.slice(i, i + perSheet));
  const mm = (n: number) => `${n}mm`;
  return <>
    <style>{`@page { size: A4; margin: 0; }`}</style>
    <div className="mx-auto mb-4 max-w-[210mm] space-y-3 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline"><Link to="/admin/purchase"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        <span className="text-sm text-muted-foreground">{all.length} labels · {cols} × {rows} = {perSheet} per sheet · {pages.length} A4 sheet(s)</span>
        <Button onClick={() => window.print()} disabled={!all.length || !perSheet}><Printer className="mr-2 h-4 w-4" />Print</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-4 lg:grid-cols-7">
        {FIELDS.map(([k, label]) => <label key={k} className="grid gap-1 text-xs font-semibold text-muted-foreground">{label} (mm)
          <Input type="number" step={0.5} min={0} className="h-8" value={layout[k]} onChange={e => update(k, Number(e.target.value))} /></label>)}
        <div className="flex flex-col justify-end gap-1">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={outlines} onChange={e => setOutlines(e.target.checked)} />Show outlines</label>
          <Button size="sm" variant="ghost" onClick={() => { localStorage.removeItem(LAYOUT_KEY); setLayout(DEFAULT_LAYOUT); }}>Reset</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Tip: print one sheet on plain paper, hold it over your label sheet against light, and adjust the margins until they line up. Print with scale 100% / "Actual size". Outlines are never printed.</p>
      {!perSheet && <p className="text-sm text-destructive">Labels are too big to fit on A4 with these margins.</p>}
    </div>
    {!all.length && <p className="text-center text-sm text-muted-foreground">No items with a barcode and quantity in this bill.</p>}
    {pages.map((page, pi) => (
      <article key={pi} className="a4-sheet relative mx-auto mb-4 grid content-start bg-background text-foreground shadow-xl print:mb-0 print:shadow-none"
        style={{ width: "210mm", height: "297mm", paddingTop: mm(layout.marginTop), paddingLeft: mm(layout.marginLeft), columnGap: mm(layout.gapX), rowGap: mm(layout.gapY), gridTemplateColumns: `repeat(${cols}, ${mm(layout.width)})`, gridAutoRows: mm(layout.height), breakAfter: "page", overflow: "hidden" }}>
        {page.map((l, i) => (
          <div key={i} className={`flex flex-col items-center justify-center overflow-hidden px-1 text-center leading-tight print:border-transparent ${outlines ? "border border-dashed border-primary/60" : "border border-transparent"}`}>
            <p className="w-full truncate text-[8px] font-bold uppercase">{company?.name}</p>
            <p className="w-full truncate text-[7.5px]">{l.name}</p>
            <p className="text-[7.5px]"><b>MRP {fmt(l.mrp)}</b> · Price {fmt(l.price)}</p>
            <Bars value={l.barcode} />
            <p className="font-mono text-[8px] tracking-widest">{l.barcode}</p>
          </div>
        ))}
      </article>
    ))}
  </>;
}
