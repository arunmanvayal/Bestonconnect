import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Wallet, Package, AlertTriangle, ArrowRight, ShoppingCart, Truck, TrendingUp, ArrowUpRight } from "lucide-react";
import { fetchBalances } from "@/lib/books";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Bestonconnect" },
      { name: "description", content: "Business overview: customers, accounts, ledger and stock at a glance." },
      { property: "og:title", content: "Admin Dashboard — Bestonconnect" },
      { property: "og:description", content: "Business overview: customers, accounts, ledger and stock at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppLayout>
      <SupabaseGate>
        <DashboardInner />
      </SupabaseGate>
    </AppLayout>
  );
}

function DashboardInner() {
  const supabase = useSupabase();

  const { data } = useQuery({
    queryKey: ["dashboard"],
    enabled: !!supabase,
    queryFn: async () => {
      if (!supabase) throw new Error("Database is not connected");
      const [customers, accounts, products, entries, invoices] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        fetchBalances(supabase).then((d) => ({ data: d, error: null })).catch((e) => ({ data: [] as any[], error: e })),
        supabase.from("products").select("id, name, quantity, reorder_level"),
        supabase
          .from("journal_entries")
          .select("id, entry_date, description, journal_lines(debit, credit)")
          .order("entry_date", { ascending: false })
          .limit(5),
        supabase.from("invoices").select("kind, net_total, bill_date, payment_mode"),
      ]);
      return {
        customerCount: customers.count ?? 0,
        accounts: accounts.data ?? [],
        products: products.data ?? [],
        recentEntries: entries.data ?? [],
        invoices: (invoices.data ?? []) as any[],
        error: customers.error ?? accounts.error ?? products.error ?? entries.error,
      };
    },
  });

  if (data?.error) {
    return (
      <div className="max-w-lg rounded-lg border border-destructive/40 bg-destructive/10 p-6">
        <h2 className="font-semibold text-foreground">Tables not found yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your database is connected, but the tables don't exist yet. Go to the{" "}
          <Link to="/setup" className="font-medium text-primary underline">
            Setup page
          </Link>{" "}
          and run the one-time script in your Supabase SQL editor.
        </p>
      </div>
    );
  }

  const accounts = data?.accounts ?? [];
  const products = data?.products ?? [];
  const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.reorder_level));
  const balanceByType = (t: string) =>
    accounts.filter((a: any) => a.type === t).reduce((s: number, a: any) => s + Number(a.balance ?? 0), 0);
  const byCode = (c: string) => Number(accounts.find((a: any) => a.code === c)?.balance ?? 0);
  const inv = data?.invoices ?? [];
  const month = new Date().toISOString().slice(0, 7);
  const sumKind = (k: string, m?: boolean) => inv.filter((i) => i.kind === k && (!m || String(i.bill_date).startsWith(month))).reduce((s, i) => s + Number(i.net_total), 0);

  const stats = [
    { label: "Customers", value: String(data?.customerCount ?? 0), icon: Users, to: "/customers" },
    { label: "Total Assets", value: money(balanceByType("asset")), icon: Wallet, to: "/accounts" },
    { label: "Products", value: String(products.length), icon: Package, to: "/stock" },
    { label: "Low Stock Alerts", value: String(lowStock.length), icon: AlertTriangle, to: "/stock" },
    { label: "Sales (this month)", value: money(sumKind("sale", true)), icon: ShoppingCart, to: "/sales" },
    { label: "Purchases (this month)", value: money(sumKind("purchase", true)), icon: Truck, to: "/purchase" },
    { label: "Receivables", value: money(byCode("1100")), icon: Wallet, to: "/accounts" },
    { label: "Payables", value: money(byCode("2000")), icon: Wallet, to: "/accounts" },
  ];
  const salesAll = sumKind("sale"), purchAll = sumKind("purchase");
  const maxBar = Math.max(salesAll, purchAll, 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase text-primary/65">Business overview</p>
          <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your live financial position and daily operations.</p>
        </div>
        <div className="hidden shrink-0 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm sm:block">{new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}</div>
      </div>

      <div className="flex flex-wrap gap-3"><Link to="/online-orders" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm font-semibold"><ShoppingCart className="h-4 w-4" />Online orders <ArrowRight className="h-4 w-4" /></Link><Link to="/online-products" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm font-semibold"><Package className="h-4 w-4" />Online products <ArrowRight className="h-4 w-4" /></Link></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }, index) => (
          <Link key={label} to={to}>
            <Card className={`group h-full overflow-hidden hover:-translate-y-1 hover:shadow-lg ${index === 0 || index === 4 ? "border-primary/10 bg-primary text-primary-foreground" : index === 2 ? "border-accent/30 bg-accent/25" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
                <CardTitle className={`text-xs font-semibold ${index === 0 || index === 4 ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</CardTitle>
                <div className={`grid h-9 w-9 place-items-center rounded-full ${index === 0 || index === 4 ? "bg-primary-foreground/12" : "bg-muted"}`}><Icon className="h-4 w-4" /></div>
              </CardHeader>
              <CardContent className="flex items-end justify-between p-5 pt-0">
                <p className="font-display text-2xl font-bold sm:text-[1.65rem]">{value}</p>
                <ArrowUpRight className="h-4 w-4 opacity-40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 p-5"><div className="min-w-0"><CardTitle className="text-base">Sales performance</CardTitle><p className="mt-1 text-xs text-muted-foreground">All-time sales, purchases and gross margin</p></div><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/25"><TrendingUp className="h-4 w-4 text-accent-foreground" /></div></CardHeader>
        <CardContent className="space-y-5 p-5">
          {[["Sales", salesAll, "bg-primary"], ["Purchase", purchAll, "bg-accent-foreground/60"], ["Gross margin", salesAll - purchAll, "bg-emerald-500"]].map(([k, v, c]) => (
            <div key={k as string} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm">
              <span className="font-medium text-muted-foreground">{k}</span><span className="font-display text-sm font-semibold">{money(Number(v))}</span>
              <div className="col-span-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${c} transition-[width] duration-700`} style={{ width: `${Math.max(0, (Number(v) / maxBar) * 100)}%` }} /></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Journal Entries</CardTitle>
            <Link to="/ledger" className="flex items-center gap-1 text-sm text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {(data?.recentEntries ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet. Add your first one in the Ledger.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data?.recentEntries.map((e: any) => {
                  const total = (e.journal_lines ?? []).reduce((s: number, l: any) => s + Number(l.debit ?? 0), 0);
                  return (
                    <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{e.description || "Journal entry"}</p>
                        <p className="text-xs text-muted-foreground">{e.entry_date}</p>
                      </div>
                      <span className="font-semibold text-foreground">{money(total)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Low Stock Items</CardTitle>
            <Link to="/stock" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Manage stock <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">All items are above their reorder level.</p>
            ) : (
              <ul className="divide-y divide-border">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      {Number(p.quantity)} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
