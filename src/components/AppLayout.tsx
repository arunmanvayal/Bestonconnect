import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Wallet,
  Package,
  Settings2,
  ShoppingCart,
  Truck,
  HandCoins,
  Menu,
  X,
  Bell,
  Search, Undo2, BarChart3 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase", icon: Truck },
  { to: "/returns", label: "Sales Returns", icon: Undo2 },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/payments", label: "Receipts & Payments", icon: HandCoins },
  { to: "/ledger", label: "Ledger", icon: BookOpen },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/setup", label: "Setup", icon: Settings2 },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  const current = NAV.find((item) => item.to === pathname) ?? NAV[0];

  const navigation = (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-5 lg:px-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">BD</div>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-sidebar-foreground">BusinessDesk</p>
          <p className="truncate text-[11px] font-medium text-sidebar-foreground/55">CRM · Accounts · Stock</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground/68 hover:translate-x-0.5 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"}`} />
              <span className="min-w-0 truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 mb-4 rounded-2xl border border-sidebar-border/70 bg-background/60 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><span className="h-2 w-2 rounded-full bg-accent" />Database connected</div>
        <p className="mt-1 text-[10px] leading-relaxed text-sidebar-foreground/50">Live records sync across every workspace.</p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background/70">
      <aside data-app-navigation className="fixed inset-y-4 left-4 z-30 hidden w-60 flex-col overflow-hidden rounded-3xl border border-sidebar-border/70 bg-sidebar text-sidebar-foreground shadow-[0_24px_60px_-36px_color-mix(in_oklab,var(--foreground)_45%,transparent)] backdrop-blur-xl lg:flex">
        {navigation}
      </aside>

      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside data-app-navigation className={`fixed inset-y-3 left-3 z-50 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 lg:hidden ${menuOpen ? "translate-x-0" : "-translate-x-[110%]"}`}>
        <Button variant="ghost" size="icon" aria-label="Close navigation" className="absolute right-3 top-4 z-10 rounded-full" onClick={() => setMenuOpen(false)}><X /></Button>
        {navigation}
      </aside>

      <header data-mobile-header className="sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Button variant="outline" size="icon" aria-label="Open navigation" className="shrink-0 rounded-full bg-card/80" onClick={() => setMenuOpen(true)}><Menu /></Button>
        <div className="min-w-0"><p className="truncate font-display text-sm font-bold">{current?.label}</p><p className="truncate text-[10px] text-muted-foreground">BusinessDesk</p></div>
        <Button variant="outline" size="icon" aria-label="Notifications" className="shrink-0 rounded-full bg-card/80"><Bell /></Button>
      </header>

      <header className="fixed left-72 right-6 top-4 z-20 hidden h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-2xl border border-border/60 bg-card/80 px-5 shadow-sm backdrop-blur-xl lg:grid">
        <div className="flex min-w-0 items-center gap-3 text-muted-foreground"><Search className="h-4 w-4 shrink-0" /><span className="truncate text-sm">Search customers, invoices, products…</span></div>
        <div className="flex shrink-0 items-center gap-3"><Button variant="ghost" size="icon" aria-label="Notifications" className="rounded-full"><Bell /></Button><div className="grid h-9 w-9 place-items-center rounded-full bg-accent/25 font-display text-xs font-bold text-accent-foreground">BD</div></div>
      </header>

      <main data-app-main className="min-w-0 px-4 pb-24 pt-5 sm:px-6 lg:ml-68 lg:px-6 lg:pb-10 lg:pt-24">
        <div className="page-enter mx-auto w-full max-w-[1600px]">{children}</div>
      </main>

      <nav data-mobile-nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-border/70 bg-card/90 p-1.5 shadow-xl backdrop-blur-xl lg:hidden">
        {NAV.slice(0, 5).map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return <Link key={to} to={to} aria-label={label} className={`flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Icon className="h-4 w-4" /><span className="max-w-full truncate px-1">{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
