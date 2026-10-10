import type { Header, Kind } from "@/lib/books";
import { emptyEntryDetails, type EntryDetails } from "@/lib/invoice-entry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { masterNames, useMasters } from "@/lib/masters";
import { useWorkspacePreferences } from "@/lib/workspace-preferences";

type Props = { kind: Kind; header: Header; set: <K extends keyof Header>(key: K, value: Header[K]) => void; pickParty: (value: string) => void; partyRef: React.RefObject<HTMLInputElement | null>; openParty: () => void; parties: any[]; billNo: string };
export function InvoiceEntryHeader({ kind, header: h, set, pickParty, partyRef, openParty, parties, billNo }: Props) {
  const { shortcuts } = useWorkspacePreferences();
  const { data: masters = [] } = useMasters();
  const details = h.entry_details ?? emptyEntryDetails(h.bill_date);
  const extra = (key: keyof EntryDetails, value: string) => set("entry_details", { ...details, [key]: value });
  const field = (label: string, child: React.ReactNode) => <label className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 text-xs"><span>{label}</span>{child}</label>;
  const selectClass = "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-xs";
  return <div className="invoice-entry-header grid gap-3 border-b border-border p-3 sm:grid-cols-2 2xl:grid-cols-4">
    <datalist id="invoice-cost-centres">{masterNames(masters,"cost_centre",details.cost_centre).map(n=><option key={n} value={n}/>)}</datalist>
    <datalist id="invoice-employees">{masterNames(masters,"employee",h.salesman).map(n=><option key={n} value={n}/>)}</datalist>
    <div className="space-y-2">{field("Bill No", <Input aria-label="Bill No" className="h-9 text-xs" value={billNo} onChange={e => set("bill_no", e.target.value)}/>)}{field("Bill Date", <Input aria-label="Bill Date" className="h-9 text-xs" type="date" value={h.bill_date} onChange={e => set("bill_date", e.target.value)}/>)}</div>
    <div className="space-y-2">{field(kind === "sale" ? "MOP" : "Bill Type", <select aria-label={kind === "sale" ? "MOP" : "Payment bill type"} className={selectClass} value={h.payment_mode} onChange={e => set("payment_mode", e.target.value)}><option value="cash">Cash</option><option value="credit">Credit</option><option value="bank">Bank</option><option value="upi">UPI</option></select>)}{field("Tax Type", <select aria-label="Tax Type" className={selectClass} value={h.tax_type} onChange={e => set("tax_type", e.target.value)}><option value="gst">GST</option><option value="igst">IGST</option><option value="none">No Tax</option></select>)}</div>
    <div className="space-y-2">{field("Party", <div className="flex min-w-0 gap-1"><Input ref={partyRef} aria-label="Party" className="h-9 min-w-0 text-xs" list={`parties-${kind}`} value={h.party_name} onChange={e => pickParty(e.target.value)}/><Button variant="secondary" size="sm" title="Focus party" onClick={() => partyRef.current?.focus()}>F11</Button><datalist id={`parties-${kind}`}>{parties.map(p => <option key={p.id} value={p.name}/>)}</datalist></div>)}{field(kind === "sale" ? "Bill Type" : "Contact No", kind === "sale" ? <select aria-label="Bill Type" className={selectClass} value={h.bill_type} onChange={e => set("bill_type", e.target.value)}><option>B2CS</option><option>B2CL</option><option>B2B</option><option>B2C</option></select> : <Input aria-label="Contact No" className="h-9 text-xs" value={h.contact} onChange={e => set("contact", e.target.value)}/>)}</div>
    <div className="space-y-2">{field("Cost Centre", <Input list="invoice-cost-centres" aria-label="Cost Centre" className="h-9 text-xs" value={details.cost_centre} onChange={e => extra("cost_centre", e.target.value)}/>)}{field(kind === "sale" ? "Source" : "SalesMan", <Input list={kind === "purchase" ? "invoice-employees" : undefined} aria-label={kind === "sale" ? "Source" : "SalesMan"} className="h-9 text-xs" value={kind === "sale" ? details.source : h.salesman} onChange={e => kind === "sale" ? extra("source", e.target.value) : set("salesman", e.target.value)}/>)}</div>
    <div className="space-y-2"><div className="grid gap-3">{kind === "sale" ? field("Voucher No", <Input aria-label="Voucher No" className="h-9 text-xs" value={details.voucher_no} onChange={e => extra("voucher_no", e.target.value)}/>) : <>{field("Order Date", <Input aria-label="Order Date" type="date" className="h-9 text-xs" value={details.order_date} onChange={e => extra("order_date", e.target.value)}/>)}{field("Order No", <Input aria-label="Order No" className="h-9 text-xs" value={details.order_no} onChange={e => extra("order_no", e.target.value)}/>)}</>}</div></div>
  </div>;
}

export function InvoiceEntryFooter({ kind, header: h, set }: Pick<Props, "kind" | "header" | "set">) {
  const { data: masters = [] } = useMasters();
  const details = h.entry_details ?? emptyEntryDetails(h.bill_date);
  const extra = (key: keyof EntryDetails, value: string) => set("entry_details", { ...details, [key]: value });
  const small = (label: string, value: string, change: (v: string) => void, type = "text") => <label className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 text-xs"><span>{label}</span><Input list={label === "Agent" ? "invoice-agents" : label === "SalesMan" ? "invoice-salespeople" : undefined} aria-label={label} className="h-8 text-xs" type={type} value={value} onChange={e => change(e.target.value)}/></label>;
  const text = (label: string, value: string, change: (v: string) => void) => <label className="block min-w-0 space-y-1 text-xs"><span>{label}</span><textarea aria-label={label} className="h-20 w-full rounded-md border border-input bg-background p-2 text-xs" value={value} onChange={e => change(e.target.value)}/></label>;
  return <div className="invoice-entry-footer grid gap-3 border-t border-border p-3 sm:grid-cols-2 xl:grid-cols-4">
    <datalist id="invoice-agents">{masterNames(masters,"agent",details.agent).map(n=><option key={n} value={n}/>)}</datalist>
    <datalist id="invoice-salespeople">{masterNames(masters,"employee",h.salesman).map(n=><option key={n} value={n}/>)}</datalist>
    <div className="space-y-2">{kind === "sale" ? <>{small("SalesMan", h.salesman, v => set("salesman", v))}{small("Agent", details.agent, v => extra("agent", v))}{small("Contact No", h.contact, v => set("contact", v))}{small("KFC Amt", details.kfc_amount, v => extra("kfc_amount", v), "number")}</> : <>{small("Ref No", h.ref_no, v => set("ref_no", v))}{small("Entry Date", details.entry_date, v => extra("entry_date", v), "date")}</>}</div>
    {kind === "sale" ? <>{text("Order Details", details.order_details, v => extra("order_details", v))}{text("Despatch Details", details.despatch_details, v => extra("despatch_details", v))}</> : text("Address", h.billing_address, v => set("billing_address", v))}
    {text("Remarks", h.remarks, v => set("remarks", v))}
    {kind === "sale" && <>{text("Shipping Address", h.shipping_address, v => set("shipping_address", v))}{text("Billing Address", h.billing_address, v => set("billing_address", v))}{text("Vehicle Details", details.vehicle_details, v => extra("vehicle_details", v))}</>}
  </div>;
}