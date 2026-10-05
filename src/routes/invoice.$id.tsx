import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { amountInWords, useActiveCompany } from "@/lib/company";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invoice/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ print: s["print"] === 1 || s["print"] === "1" ? 1 : undefined }),
  head: () => ({
    meta: [
      { title: "Print Invoice — BusinessDesk" },
      { name: "description", content: "A4 printable tax invoice with company logo, GST, bank details and terms." },
      { property: "og:title", content: "Print Invoice — BusinessDesk" },
      { property: "og:description", content: "A4 printable tax invoice with company logo, GST, bank details and terms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-muted/50 px-3 py-6 print:bg-transparent print:p-0">
      <SupabaseGate><PrintInvoice /></SupabaseGate>
    </div>
  ),
});

const fmt = (n: number) => Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PrintInvoice() {
  const { id } = Route.useParams();
  const { print } = Route.useSearch();
  const sb = useSupabase()!;
  const { data: company } = useActiveCompany();
  const { data, isLoading } = useQuery({
    queryKey: ["invoice-print", id],
    queryFn: async () => {
      const { data: inv, error } = await sb.from("invoices").select("*").eq("id", id).single();
      if (error) throw error;
      const [{ data: items }, party] = await Promise.all([
        sb.from("invoice_items").select("*").eq("invoice_id", id),
        inv.party_id ? sb.from("customers").select("gstin, email, address").eq("id", inv.party_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { inv, items: items ?? [], party: party.data as any };
    },
  });

  useEffect(() => {
    if (print && data && company) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); }
    return undefined;
  }, [print, data, company]);

  if (isLoading || !company) return <p className="text-center text-sm text-muted-foreground">Loading invoice…</p>;
  if (!data) return <p className="text-center text-sm text-muted-foreground">Invoice not found in this company.</p>;
  const { inv, items, party } = data;
  const isSale = inv.kind === "sale";
  const minRows = Math.max(0, 8 - items.length);

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline"><Link to={isSale ? "/sales" : "/purchase"}><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print A4</Button>
      </div>

      <article className="a4-sheet mx-auto flex flex-col bg-card text-[11px] leading-snug text-foreground shadow-xl print:shadow-none">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch">
          <div className="flex items-center gap-3 px-8 py-6">
            {company.logo
              ? <img src={company.logo} alt="" className="h-16 w-16 object-contain" />
              : <div className="grid h-14 w-14 place-items-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">{company.name.slice(0, 2).toUpperCase()}</div>}
            <div className="min-w-0">
              <p className="font-display text-lg font-bold uppercase tracking-wide text-primary">{company.name}</p>
              {company.tagline && <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{company.tagline}</p>}
            </div>
          </div>
          <div className="flex items-center bg-primary px-10 [clip-path:polygon(12%_0,100%_0,100%_100%,0_100%)]">
            <h1 className="font-display text-3xl font-bold tracking-wider text-primary-foreground">{isSale ? "INVOICE" : "PURCHASE"}</h1>
          </div>
        </header>
        <div className="flex justify-between bg-foreground px-8 py-1.5 text-[10px] font-semibold text-background">
          <span>Invoice No: {inv.bill_no}</span>
          <span>{inv.tax_type === "gst" ? "TAX INVOICE" : ""}</span>
          <span>Date: {new Date(inv.bill_date).toLocaleDateString("en-IN")}</span>
        </div>

        {/* Parties */}
        <section className="grid grid-cols-2 gap-8 px-8 py-5">
          <div>
            <h2 className="mb-1 font-display text-[11px] font-bold uppercase text-primary">{isSale ? "Invoice to:" : "Supplier:"}</h2>
            <p className="font-semibold">{inv.party_name || "Cash customer"}</p>
            {(inv.billing_address || party?.address) && <p className="whitespace-pre-line">{inv.billing_address || party?.address}</p>}
            {inv.contact && <p>Ph: {inv.contact}</p>}
            {party?.email && <p>{party.email}</p>}
            {party?.gstin && <p>GSTIN: {party.gstin}</p>}
          </div>
          <div>
            <h2 className="mb-1 font-display text-[11px] font-bold uppercase text-primary">From:</h2>
            {company.address && <p className="whitespace-pre-line">{company.address}{company.state ? `, ${company.state}` : ""}</p>}
            {company.phone && <p>Ph: {company.phone}</p>}
            {company.email && <p>{company.email}</p>}
            {company.gstin && <p className="font-semibold">GSTIN: {company.gstin}</p>}
            <p className="mt-1 text-muted-foreground">Payment: {String(inv.payment_mode).toUpperCase()}{inv.ref_no ? ` · Ref ${inv.ref_no}` : ""}</p>
          </div>
        </section>

        {/* Items */}
        <section className="px-8">
          <table className="w-full border-collapse border border-foreground/70 text-[10.5px]">
            <thead>
              <tr className="bg-muted">
                {["No", "Item Description", "Qty", "Rate", "Disc", "GST %", "Taxable", "Total"].map((h, i) => (
                  <th key={h} className={`border border-foreground/70 px-2 py-1.5 font-semibold ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={it.id}>
                  <td className="border-x border-foreground/70 px-2 py-1.5">{i + 1}.</td>
                  <td className="border-x border-foreground/70 px-2 py-1.5">{it.item_name}</td>
                  <td className="border-x border-foreground/70 px-2 py-1.5 text-right">{Number(it.quantity)}{Number(it.free_qty) ? ` +${Number(it.free_qty)}` : ""} {it.unit}</td>
                  <td className="border-x border-foreground/70 px-2 py-1.5 text-right">{fmt(it.rate)}</td>
                  <td className="border-x border-foreground/70 px-2 py-1.5 text-right">{Number(it.discount) ? fmt(it.discount) : "—"}</td>
                  <td className="border-x border-foreground/70 px-2 py-1.5 text-right">{Number(it.gst_rate)}%</td>
                  <td className="border-x border-foreground/70 px-2 py-1.5 text-right">{fmt(it.taxable)}</td>
                  <td className="border-x border-foreground/70 px-2 py-1.5 text-right font-semibold">{fmt(it.amount)}</td>
                </tr>
              ))}
              {Array.from({ length: minRows }).map((_, i) => (
                <tr key={`e${i}`}>{Array.from({ length: 8 }).map((__, j) => <td key={j} className="h-6 border-x border-foreground/70" />)}</tr>
              ))}
              <tr><td colSpan={8} className="border-t border-foreground/70" /></tr>
            </tbody>
          </table>
        </section>

        {/* Payment + totals */}
        <section className="grid grid-cols-[minmax(0,1fr)_250px] gap-8 px-8 py-4">
          <div className="space-y-3">
            <div>
              <h2 className="mb-1 font-display text-[11px] font-bold uppercase text-primary">Amount in words</h2>
              <p className="font-semibold italic">{amountInWords(inv.net_total)}</p>
            </div>
            {(company.bank_name || company.account_no || company.upi) && (
              <div>
                <h2 className="mb-1 font-display text-[11px] font-bold uppercase text-primary">Payment method</h2>
                <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-0.5">
                  {company.bank_name && <><dt>Bank Name</dt><dd>: {company.bank_name}</dd></>}
                  {company.account_name && <><dt>Account Name</dt><dd>: {company.account_name}</dd></>}
                  {company.account_no && <><dt>Account Number</dt><dd>: {company.account_no}</dd></>}
                  {company.ifsc && <><dt>IFSC</dt><dd>: {company.ifsc}</dd></>}
                  {company.upi && <><dt>UPI</dt><dd>: {company.upi}</dd></>}
                </dl>
              </div>
            )}
          </div>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 self-start">
            <dt>Sub Total</dt><dd className="text-right">{fmt(inv.gross)}</dd>
            {Number(inv.discount) > 0 && <><dt>Discount</dt><dd className="text-right">−{fmt(inv.discount)}</dd></>}
            <dt>Taxable</dt><dd className="text-right">{fmt(inv.taxable)}</dd>
            {Number(inv.igst) > 0
              ? <><dt>IGST</dt><dd className="text-right">{fmt(inv.igst)}</dd></>
              : <><dt>CGST</dt><dd className="text-right">{fmt(inv.cgst)}</dd><dt>SGST</dt><dd className="text-right">{fmt(inv.sgst)}</dd></>}
            {Number(inv.freight) + Number(inv.other_exp) > 0 && <><dt>Freight & other</dt><dd className="text-right">{fmt(Number(inv.freight) + Number(inv.other_exp))}</dd></>}
            {Number(inv.cash_disc) > 0 && <><dt>Cash discount</dt><dd className="text-right">−{fmt(inv.cash_disc)}</dd></>}
            {Number(inv.round_off) !== 0 && <><dt>Round off</dt><dd className="text-right">{fmt(inv.round_off)}</dd></>}
            <dt className="mt-1 border-t border-foreground/70 pt-1.5 font-display text-sm font-bold">Total</dt>
            <dd className="mt-1 border-t border-foreground/70 pt-1.5 text-right font-display text-sm font-bold text-primary">{money(inv.net_total)}</dd>
          </dl>
        </section>

        {/* Terms + signature */}
        <section className="mt-auto grid grid-cols-[minmax(0,1fr)_200px] items-end gap-8 px-8 pb-6">
          <div>
            {(company.terms || inv.remarks) && <h2 className="mb-1 font-display text-[11px] font-bold uppercase text-primary">Terms and conditions</h2>}
            {company.terms && <p className="whitespace-pre-line text-muted-foreground">{company.terms}</p>}
            {inv.remarks && <p className="mt-1">Remarks: {inv.remarks}</p>}
          </div>
          <div className="text-center">
            <p className="mb-10 text-[10px] text-muted-foreground">For {company.name}</p>
            <p className="border-t border-foreground pt-1 text-[10px] font-semibold uppercase">{company.signature_label || "Authorised Signatory"}</p>
          </div>
        </section>
        <footer className="grid grid-cols-[1fr_3fr_1fr]"><span className="h-3 bg-foreground" /><span className="h-3 bg-primary" /><span className="h-3 bg-foreground" /></footer>
      </article>
    </>
  );
}
