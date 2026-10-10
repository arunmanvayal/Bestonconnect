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

export function gstDetails(invoices: any[], items: any[], returns: any[]) {
  const byId = new Map(invoices.map(i=>[i.id,i]));
  const bills = invoices.map(i=>({ ...i, gstin: i.entry_details?.party_gstin || "", classification: i.kind === "purchase" ? "Input" : i.entry_details?.party_gstin ? "B2B" : "B2C", kfc: Number(i.entry_details?.kfc_amount || 0) }));
  const hsn = new Map<string,any>();
  for (const item of items) {
    const inv=byId.get(item.invoice_id);if (!inv) continue;
    const code=item.entry_details?.hsn || "Unspecified";const key=`${inv.kind}:${code}:${item.gst_rate}`;
    const row=hsn.get(key) ?? { hsn:code,kind:inv.kind,rate:Number(item.gst_rate),quantity:0,taxable:0,cgst:0,sgst:0,igst:0,total_tax:0 };
    row.quantity+=Number(item.quantity);row.taxable+=Number(item.taxable);row.total_tax+=Number(item.tax);
    if (inv.tax_type==='igst') row.igst+=Number(item.tax);else if(inv.tax_type==='gst'){row.cgst+=Number(item.tax)/2;row.sgst+=Number(item.tax)/2;}
    hsn.set(key,row);
  }
  const creditNotes = returns.map(r=>({ ...r, bill_date:r.return_date,bill_no:r.return_no,kind:"return",gstin:byId.get(r.invoice_id)?.entry_details?.party_gstin || "",classification:"Credit note",net_total:-Number(r.amount),total_tax:-Number(r.total_tax),taxable:-Number(r.taxable) }));
  return { bills:[...bills,...creditNotes],hsn:[...hsn.values()] };
}
