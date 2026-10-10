/** Money rounding shared by entry rows, saved-document presentation and return previews. */
export const moneyRound = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
export function savedItemPresentation(item: any, invoice: any) {
  const gross = moneyRound(Number(item.quantity) * Number(item.rate));
  const taxable = Number(item.taxable || 0), tax = Number(item.tax || 0);
  const cgst = invoice.tax_type === 'gst' ? moneyRound(tax / 2) : 0;
  return { gross, discount: moneyRound(gross - taxable), discountPercent: gross ? moneyRound((gross - taxable) / gross * 100) : 0,
    taxable, tax, amount: Number(item.amount || 0), cgst, sgst: invoice.tax_type === 'gst' ? moneyRound(tax - cgst) : 0,
    igst: invoice.tax_type === 'igst' ? tax : 0, rate: invoice.tax_type === 'none' ? 0 : Number(item.gst_rate || 0) };
}
export function returnAllocation(items: any[], invoice: any) {
  const ordered = [...items].sort((a,b) => String(a.id).localeCompare(String(b.id)));
  const subtotal = ordered.reduce((sum, it) => sum + Number(it.amount), 0);
  const totalQty = ordered.reduce((sum,it) => sum + Number(it.quantity),0);
  let preceding = 0;
  return new Map(ordered.map(it => {
    const weight = subtotal > 0 ? Number(it.amount) : Number(it.quantity);
    const denominator = subtotal > 0 ? subtotal : totalQty;
    const allocation = denominator > 0 ? moneyRound(Number(invoice.net_total)*(preceding+weight)/denominator)-moneyRound(Number(invoice.net_total)*preceding/denominator) : 0;
    preceding += weight;
    return [it.id, moneyRound(allocation)] as const;
  }));
}
export function returnLineTotals(line: { sold: number; returned: number; qty: number; allocation: number; taxableTotal: number; taxTotal: number }) {
  const portion = (total: number) => line.sold > 0 ? moneyRound(moneyRound(total*(line.returned+line.qty)/line.sold)-moneyRound(total*line.returned/line.sold)) : 0;
  return { amount: portion(line.allocation), taxable: portion(line.taxableTotal), tax: portion(line.taxTotal) };
}
