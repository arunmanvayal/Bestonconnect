import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { amountInWords, useActiveCompany } from "@/lib/company";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/invoice/$id")({
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
  const sb = useSupabase();
  const { data: company } = useActiveCompany();
  const { data, isLoading } = useQuery({
    queryKey: ["invoice-print", id],
    enabled: !!sb,
    queryFn: async () => {
      if (!sb) throw new Error("Database is not connected");
      const { data: inv, error } = await sb.from("invoices").select("*").eq("id", id).single();
      if (error) throw error;
      const [{ data: items }, party] = await Promise.all([
        sb.from("invoice_items").select("*").eq("invoice_id", id),
        inv.party_id ? sb.from("customers").select("gstin, email, address").eq("id", inv.party_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const pids = (items ?? []).map((i: any) => i.product_id).filter(Boolean);
      const { data: prods } = pids.length ? await sb.from("products").select("id, hsn").in("id", pids) : { data: [] as any[] };
      const hsn: Record<string, string> = {};
      (prods ?? []).forEach((p: any) => { hsn[p.id] = p.hsn ?? ""; });
      return { inv, items: (items ?? []).map((i: any) => ({ ...i, hsn: hsn[i.product_id] ?? "" })), party: party.data as any };
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
  const fillRows = Math.max(0, 28 - items.length);
  const totalQty = items.reduce((a: number, i: any) => a + Number(i.quantity || 0), 0);
  const itemTotal = items.reduce((a: number, i: any) => a + Number(i.amount || 0), 0);
  const stateCode = (company.gstin || "").slice(0, 2);
  const date = new Date(inv.bill_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  const B = "border-foreground";
  const td = `border-x ${B} px-1 py-[3px] align-top`;
  const cols = ["No", "Name of Product / Service", "HSN Code", "Qty", "Rate", "Gross Amt.", "Disc %", "Taxable Value", "CGST %", "CGST Amt", "SGST %", "SGST Amt", "Total"];
  const widths = ["4%", "22%", "10%", "5%", "7%", "7.5%", "5%", "7.5%", "5%", "6.5%", "5%", "6.5%", "9%"];

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline"><Link to={isSale ? "/admin/sales" : "/admin/purchase"}><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print A4</Button>
      </div>

      <article className="a4-sheet invoice-monochrome mx-auto bg-background p-[8mm] font-sans text-[10.5px] leading-tight text-foreground shadow-xl print:shadow-none">
        <div className={`flex h-full flex-col border ${B}`}>
          {/* Header */}
          <header className="px-2 pb-1 pt-2 text-center">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-left">
            <p className="break-words text-[10px] font-bold">GSTIN : {company.gstin}</p>
            <div className="shrink-0 text-left text-[9px]">
              {["Original for Recipient", "Duplicate for Transporter", "Triplicate for Supplier"].map((t) => (
                <p key={t} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 border ${B}`} />{t}</p>
              ))}
            </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
            {company.logo && <img src={company.logo} alt="" className="h-10 w-10 shrink-0 object-contain grayscale" />}
            <h1 className="min-w-0 break-words text-[24px] font-semibold uppercase">{company.name}</h1>
            </div>
            {company.address && <p className="uppercase">{company.address}{company.state ? `, ${company.state}` : ""}</p>}
            <p>{company.phone}{company.email ? ` E MAIL : ${company.email}` : ""}</p>
            <p className="mt-2 text-[13px] font-bold">{isSale ? "INVOICE" : "PURCHASE INVOICE"}</p>
          </header>

          {/* Meta */}
          <div className={`grid grid-cols-2 border-t ${B}`}>
            <div className={`space-y-1 border-r ${B} p-1.5 font-semibold`}>
              <p><span className="inline-block w-24">Invoice No.</span>: {inv.bill_no}</p>
              <p><span className="inline-block w-24">Invoice Date</span>: {date}</p>
              <p className="flex justify-between"><span>State : {company.state || "—"} &nbsp; State Code : {stateCode}</span><span>Pay Mode : {String(inv.payment_mode).replace(/^./, (c: string) => c.toUpperCase())}</span></p>
            </div>
            <div className="p-1.5">{inv.ref_no && <p>Ref No : {inv.ref_no}</p>}</div>
          </div>

          {/* Parties */}
          <div className={`grid grid-cols-2 border-t-2 ${B}`}>
            <p className={`border-b border-r ${B} py-1 text-center text-[11px]`}>Details of Receiver | Billed to:</p>
            <p className={`border-b ${B} py-1 text-center text-[11px]`}>Details of Consignee | Shipped to:</p>
            <div className={`min-h-[22mm] space-y-1 border-r ${B} p-1.5 font-semibold`}>
              <p className="text-[11px]">{isSale ? "Customer" : "Supplier"}: {String(inv.party_name || "Cash").toUpperCase()}</p>
              {(inv.billing_address || party?.address) && <p className="whitespace-pre-line font-normal">{inv.billing_address || party?.address}</p>}
              <p>Ph: {inv.contact}</p>
              <p>GSTIN : {party?.gstin}</p>
            </div>
            <div className="p-1.5 whitespace-pre-line">{inv.shipping_address}</div>
          </div>

          {/* Items */}
          <table className={`w-full flex-1 table-fixed border-collapse border-t ${B}`}>
            <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
            <thead>
              <tr>{cols.map((h) => <th key={h} className={`border ${B} px-1 py-1 text-left align-middle text-[10px] font-semibold`}>{h}</th>)}</tr>
            </thead>
            <tbody className="font-semibold">
              {items.map((it: any, i: number) => {
                const half = Number(inv.igst) > 0 ? 0 : Number(it.tax) / 2;
                const rate = Number(it.gst_rate) / 2;
                const disc = Number(it.discount || 0);
                const gross = Number(it.taxable) + disc;
                const discPct = gross ? Math.round((disc / gross) * 1000) / 10 : 0;
                return (
                  <tr key={it.id}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} uppercase`}>{it.item_name}</td>
                    <td className={td}>{it.hsn}</td>
                    <td className={`${td} text-center`}>{Number(it.quantity)}</td>
                    <td className={`${td} text-right`}>{fmt(it.rate)}</td>
                    <td className={`${td} text-right`}>{fmt(gross)}</td>
                    <td className={`${td} text-center`}>{discPct}</td>
                    <td className={`${td} text-right`}>{fmt(it.taxable)}</td>
                    <td className={td}>{rate.toFixed(1)}</td>
                    <td className={`${td} text-right`}>{fmt(half)}</td>
                    <td className={td}>{rate.toFixed(1)}</td>
                    <td className={`${td} text-right`}>{fmt(half)}</td>
                    <td className={`${td} text-right`}>{fmt(it.amount)}</td>
                  </tr>
                );
              })}
              {Array.from({ length: fillRows }).map((_, i) => (
                <tr key={`f${i}`}>{cols.map((_c, j) => <td key={j} className={`${td} h-[15px]`} />)}</tr>
              ))}
              <tr className={`border-y ${B}`}>
                <td colSpan={3} className="py-1" />
                <td className="py-1 text-center">{Math.round(totalQty * 1000) / 1000}</td>
                <td colSpan={8} />
                <td className="py-1 pr-1 text-right">{fmt(itemTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-2 pt-2">
            <p className="text-[12px]">{amountInWords(inv.net_total)}</p>
            <p className="flex items-baseline gap-10"><span className="text-[12px]">Round Off :{fmt(inv.round_off)}</span><span className="text-[17px] font-semibold">Bill Amount : {fmt(inv.net_total)}</span></p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-4 px-2 pb-2 pt-4">
            <dl className="grid grid-cols-[85px_minmax(0,1fr)] font-bold">
              <dt>A/C No</dt><dd>: {company.account_no}</dd>
              <dt>Bank Name</dt><dd className="uppercase">: {company.bank_name}</dd>
              <dt>Name</dt><dd className="uppercase">: {company.account_name}</dd>
              <dt>IFS CODE</dt><dd className="uppercase">: {company.ifsc}</dd>
            </dl>
            <div className="flex flex-col items-end justify-between text-[11px] font-semibold">
              <p>For {company.name},</p>
              <p className="mt-10">{company.signature_label || "Authorised Signature"}</p>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
