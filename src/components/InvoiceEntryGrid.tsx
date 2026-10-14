import type { Line, Kind } from "@/lib/books";
import { lineCalc } from "@/lib/books";
import { discountAmount, discountPercent } from "@/lib/invoice-entry";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const invoiceColumns = (kind: Kind) => kind === "sale"
  ? ["No", "Barcode", "Item code", "Item Name", "Unit", "Quantity", "SL.NO", "MRP", "Rate", "Gross Amt", "Disc %", "Taxable", "GST %", "GST Amt", "Total"]
  : ["No", "Item Code", "Item Name", "Barcode", "Unit", "Quantity", "FreeQty", "Unit Price", "Profit %", "Cost", "Sale Price", "MRP", "Disc %", "Taxable", "GST %", "GST Amt", "Total"];
export const invoiceWidths = (kind: Kind) => kind === "sale"
  ? [44, 112, 108, 220, 64, 86, 90, 90, 90, 108, 80, 108, 70, 100, 112]
  : [44, 108, 220, 112, 64, 86, 80, 100, 80, 100, 100, 90, 80, 108, 70, 100, 112];
type Props = { kind: Kind; line: Line; row: number; taxType: string; update: (patch: Partial<Line>) => void; barcode: (value: string) => void; item: React.ReactNode; calculated?: { taxable: number; tax: number; amount: number } | undefined };
export function InvoiceEntryCells({ kind, line: l, row, taxType, update, barcode, item, calculated }: Props) {
  const c = lineCalc(l);
  const number = (v: string) => Number(v) || 0;
  const input = (key: keyof Line, label: string, numeric = false, change?: (value: string) => void) => <td><Input aria-label={`${label} row ${row + 1}`} className="h-8 rounded-none border-0 bg-transparent px-2 text-xs focus-visible:ring-1" data-row={row} data-col={key === "quantity" ? "qty" : key} type={numeric ? "number" : "text"} min={numeric ? 0 : undefined} value={String(l[key] ?? "")} onChange={e => change ? change(e.target.value) : update({ [key]: numeric ? number(e.target.value) : e.target.value })}/></td>;
  const codeCell = input("sku", "Item code");
  const barcodeCell = input("barcode", "Barcode", false, barcode);
  const discountCell = <td><Input aria-label={`Discount percent row ${row + 1}`} data-row={row} data-col="discount" className="h-8 rounded-none border-0 bg-transparent px-2 text-xs" type="number" min={0} max={100} value={discountPercent(c.gross, l.discount) || ""} onChange={e => update({ discount: discountAmount(c.gross, number(e.target.value)) })}/></td>;
  const tax = calculated?.tax ?? (taxType === "none" ? 0 : c.tax);
  const taxable = calculated?.taxable ?? c.taxable;
  return <>
    <td className="px-2 text-muted-foreground">{row + 1}</td>
    {kind === "sale" ? <>{barcodeCell}{codeCell}<td>{item}</td></> : <>{codeCell}<td>{item}</td>{barcodeCell}</>}
    {l.alt_unit && l.main_unit ? <td><Select value={l.unit} onValueChange={unit => { const factor = unit === l.alt_unit ? Number(l.conv_factor || 1) : 1; const ratio = factor / Number(l.unit_factor || 1); update({ unit, unit_factor: factor, rate: l.rate * ratio, sale_price: Number(l.sale_price || 0) * ratio }); }}><SelectTrigger aria-label={`Unit row ${row+1}`} className="h-8 rounded-none border-0 px-2"><SelectValue/></SelectTrigger><SelectContent><SelectItem value={l.main_unit}>{l.main_unit}</SelectItem><SelectItem value={l.alt_unit}>{l.alt_unit}</SelectItem></SelectContent></Select></td> : input("unit", "Unit")}
    {input("quantity", "Quantity", true)}
    {kind === "sale" ? <>{input("serial_no", "Serial number")}{input("mrp", "MRP", true)}{input("rate", "Rate", true)}<td className="px-2 text-right tabular-nums">{c.gross.toFixed(2)}</td></> : <>
      {input("free_qty", "Free quantity", true)}
      {input("rate", "Unit price", true, v => { const rate = number(v); update({ rate, sale_price: Math.round(rate * (1 + l.profit_pct / 100) * 100) / 100 }); })}
      {input("profit_pct", "Profit percent", true, v => { const profit_pct = number(v); update({ profit_pct, sale_price: Math.round(l.rate * (1 + profit_pct / 100) * 100) / 100 }); })}
      <td className="px-2 text-right tabular-nums">{l.rate.toFixed(2)}</td>
      {input("sale_price", "Sale price", true)}{input("mrp", "MRP", true)}
    </>}
    {discountCell}<td className="px-2 text-right tabular-nums">{taxable.toFixed(2)}</td>
    {input("gst_rate", "GST percent", true)}<td className="px-2 text-right tabular-nums">{tax.toFixed(2)}</td><td className="px-2 text-right font-semibold tabular-nums">{(calculated?.amount ?? taxable + tax).toFixed(2)}</td>
  </>;
}