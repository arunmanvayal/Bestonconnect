import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { SupabaseGate } from "@/components/SupabaseGate";
import { useActiveCompany } from "@/lib/company";
import { code128 } from "@/lib/code128";
import { Button } from "@/components/ui/button";

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

function Labels() {
  const { data: company } = useActiveCompany();
  const [labels, setLabels] = useState<BarcodeLabel[] | null>(null);
  useEffect(() => { try { setLabels(JSON.parse(localStorage.getItem(BARCODE_KEY) || "[]")); } catch { setLabels([]); } }, []);
  if (!labels) return null;
  const all = labels.flatMap(l => Array.from({ length: Math.max(0, Math.floor(l.copies)) }, () => l));
  const pages: BarcodeLabel[][] = [];
  for (let i = 0; i < all.length; i += 40) pages.push(all.slice(i, i + 40));
  return <>
    <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 print:hidden">
      <Button asChild variant="outline"><Link to="/admin/purchase"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
      <span className="text-sm text-muted-foreground">{all.length} labels · {pages.length} A4 sheet(s)</span>
      <Button onClick={() => window.print()} disabled={!all.length}><Printer className="mr-2 h-4 w-4" />Print</Button>
    </div>
    {!all.length && <p className="text-center text-sm text-muted-foreground">No items with a barcode and quantity in this bill.</p>}
    {pages.map((page, pi) => (
      <article key={pi} className="a4-sheet mx-auto mb-4 grid grid-cols-4 grid-rows-[repeat(10,25.4mm)] gap-x-[2.5mm] bg-background px-[5mm] py-[12mm] text-foreground shadow-xl print:mb-0 print:shadow-none">
        {page.map((l, i) => (
          <div key={i} className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-border px-1 text-center leading-tight print:border-transparent">
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
