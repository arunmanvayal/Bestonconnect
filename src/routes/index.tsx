import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Wallet, Package, AlertTriangle, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — BusinessDesk" },
      { name: "description", content: "Business overview: customers, accounts, ledger and stock at a glance." },
      { property: "og:title", content: "Dashboard — BusinessDesk" },
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
  const supabase = useSupabase()!;

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [customers, accounts, products, entries] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("accounts").select("type, opening_balance"),
        supabase.from("products").select("id, name, quantity, reorder_level"),
        supabase
          .from("journal_entries")
          .select("id, entry_date, description, journal_lines(debit, credit)")
          .order("entry_date", { ascending: false })
          .limit(5),
      ]);
      return {
        customerCount: customers.count ?? 0,
        accounts: accounts.data ?? [],
        products: products.data ?? [],
        recentEntries: entries.data ?? [],
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
    accounts.filter((a) => a.type === t).reduce((s, a) => s + Number(a.opening_balance ?? 0), 0);

  const stats = [
    { label: "Customers", value: String(data?.customerCount ?? 0), icon: Users, to: "/customers" },
    { label: "Total Assets", value: money(balanceByType("asset")), icon: Wallet, to: "/accounts" },
    { label: "Products", value: String(products.length), icon: Package, to: "/stock" },
    { label: "Low Stock Alerts", value: String(lowStock.length), icon: AlertTriangle, to: "/stock" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your business at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Journal Entries</CardTitle>
            <Link to="/ledger" className="flex items-center gap-1 text-sm text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {(data?.recentEntries ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet. Add your first one in the Ledger.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data!.recentEntries.map((e: any) => {
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Low Stock Items</CardTitle>
            <Link to="/stock" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Manage stock <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
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
