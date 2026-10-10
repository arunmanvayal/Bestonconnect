type TaxInvoice = { bill_date: string; kind: string; taxable: number | string; total_tax: number | string };
type TaxReturn = { return_date: string; total_tax: number | string };
export function gstReport(invoices: TaxInvoice[], returns: TaxReturn[]) {
  const months = new Map<string, { month: string; out_taxable: number; output: number; ret_tax: number; in_taxable: number; input: number; net: number }>();
  const row = (month: string) => months.get(month) ?? { month, out_taxable: 0, output: 0, ret_tax: 0, in_taxable: 0, input: 0, net: 0 };
  for (const invoice of invoices) {
    const month = invoice.bill_date.slice(0, 7); const r = row(month);
    if (invoice.kind === 'sale') { r.out_taxable += Number(invoice.taxable); r.output += Number(invoice.total_tax); }
    else { r.in_taxable += Number(invoice.taxable); r.input += Number(invoice.total_tax); }
    months.set(month, r);
  }
  for (const item of returns) { const month = item.return_date.slice(0, 7); const r = row(month); r.ret_tax += Number(item.total_tax); months.set(month, r); }
  return [...months.values()].map(r => ({ ...r, net: Math.round((r.output - r.ret_tax - r.input) * 100) / 100 })).sort((a,b) => b.month.localeCompare(a.month));
}
