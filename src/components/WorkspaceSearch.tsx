import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useSupabase } from "@/lib/supabase";
import { useActiveCompany } from "@/lib/company";
import { fetchSearchRecords } from "@/lib/search-data";
import { matchesSearch } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function WorkspaceSearch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sb = useSupabase();
  const { data: company } = useActiveCompany();
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace-search", company?.id], enabled: open && !!sb && !!company,
    queryFn: async () => {
      if (!sb || !company) throw new Error("Choose a company");
      const scope = (q: any) => q.eq("company_id", company.id);
      const [customers, products, invoices] = await Promise.all([
        fetchSearchRecords(sb, "customers", "name", scope),
        fetchSearchRecords(sb, "products", "name", scope),
        fetchSearchRecords(sb, "invoices", "bill_date", scope),
      ]);
      return { customers, products, invoices };
    },
  });
  const groups = [
    { label: "Customers & suppliers", to: "/admin/customers", records: (data?.customers ?? []).filter(c => matchesSearch(search, c.name, c.code, c.company, c.phone, c.email, c.gstin)).map(c => ({ id: c.id, title: c.name, detail: [c.code, c.phone].filter(Boolean).join(" · ") })) },
    { label: "Products", to: "/admin/stock", records: (data?.products ?? []).filter(p => matchesSearch(search, p.name, p.sku, p.barcode, p.category, p.hsn)).map(p => ({ id: p.id, title: p.name, detail: [p.sku, p.barcode].filter(Boolean).join(" · ") })) },
    { label: "Invoices", to: "/admin/invoice/$id", records: (data?.invoices ?? []).filter(i => matchesSearch(search, i.bill_no, i.party_name, i.contact, i.ref_no)).map(i => ({ id: i.id, title: i.bill_no, detail: [i.party_name, i.bill_date].filter(Boolean).join(" · ") })) },
  ];
  return <>
    <Button variant="ghost" size={compact ? "icon" : "default"} aria-label="Search customers, invoices and products" onClick={() => setOpen(true)} className={compact ? "shrink-0" : "min-w-0 justify-start text-muted-foreground"}><Search className="h-4 w-4 shrink-0"/>{!compact && <span className="truncate">Search customers, invoices, products…</span>}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogTitle>Search workspace</DialogTitle><DialogDescription>Customers, suppliers, products and invoices</DialogDescription>
      <Input autoFocus aria-label="Search workspace records" placeholder="Name, bill number, item code or barcode" value={search} onChange={e => setSearch(e.target.value)}/>
      {isLoading ? <p className="py-6 text-muted-foreground">Loading records…</p> : error ? <p role="alert">Could not load records. Close search and try again.</p> : !search.trim() ? null : groups.every(g => !g.records.length) ? <p className="py-6 text-muted-foreground">No matching records.</p> : groups.map(g => g.records.length > 0 && <section key={g.label}><h2 className="mb-2 text-sm font-semibold">{g.label} ({g.records.length})</h2><div className="divide-y divide-border">{g.records.slice(0, 30).map(r => <Button key={r.id} asChild variant="ghost" className="h-auto w-full justify-start py-3"><Link to={g.to} params={g.to === "/admin/invoice/$id" ? { id: r.id } : {}} onClick={() => setOpen(false)}><span className="min-w-0 text-left"><span className="block break-words">{r.title}</span><span className="block break-words text-xs font-normal text-muted-foreground">{r.detail}</span></span></Link></Button>)}</div>{g.records.length > 30 && <Button asChild variant="link"><Link to={g.label === "Invoices" ? "/admin/sales" : g.to} onClick={() => setOpen(false)}>Open {g.label.toLowerCase()}</Link></Button>}</section>)}
    </DialogContent></Dialog>
  </>;
}