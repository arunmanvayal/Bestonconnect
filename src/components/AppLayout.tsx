import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  Search, Undo2, UserCircle, BarChart3, PanelLeftClose, PanelLeftOpen, Wrench } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkspacePreferencesDialog } from "@/components/WorkspacePreferencesDialog";
import { WorkspaceSearch } from "@/components/WorkspaceSearch";
import { useActiveCompany } from "@/lib/company";
import { emitWorkspaceCommand, normalizeShortcut, useWorkspacePreferences, type CommandId } from "@/lib/workspace-preferences";

const NAV = [
  { to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  { to: "/admin/sales", label: "Sales", icon: ShoppingCart },
  { to: "/admin/purchase", label: "Purchase", icon: Truck },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/accounts", label: "Accounts", icon: Wallet },
  { to: "/admin/payments", label: "Receipts & Payments", icon: HandCoins },
  { to: "/admin/returns", label: "Sales Returns", icon: Undo2 },
  { to: "/admin/ledger", label: "Ledger", icon: BookOpen },
  { to: "/admin/stock", label: "Stock", icon: Package },
  { to: "/admin/online-products", label: "Online Products", icon: Package },
  { to: "/admin/online-orders", label: "Online Orders", icon: ShoppingCart },
  { to: "/admin/online-shop", label: "Online Shop", icon: ShoppingCart },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/tools", label: "Tools", icon: Wrench },
  { to: "/admin/profile", label: "Profile & Companies", icon: UserCircle },
  { to: "/admin/setup", label: "Setup", icon: Settings2 },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, setCollapsed, shortcuts } = useWorkspacePreferences();

  const { data: company } = useActiveCompany();
  const brand = company?.name ?? "BusinessDesk";
  const initials = brand.slice(0, 2).toUpperCase();
  const current = NAV.find((item) => item.to === pathname) ?? NAV[0];
  const invoiceEntry = pathname === "/admin/sales" || pathname === "/admin/purchase";

  useEffect(() => {
    const routes: Partial<Record<CommandId, string>> = {
      navDashboard: "/admin", navSales: "/admin/sales", navPurchase: "/admin/purchase", navCustomers: "/admin/customers",
      navAccounts: "/admin/accounts", navPayments: "/admin/payments", navReturns: "/admin/returns", navLedger: "/admin/ledger",
      navStock: "/admin/stock", navReports: "/admin/reports",
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = normalizeShortcut(event);
      const id = (Object.entries(shortcuts) as Array<[CommandId, string]>).find(([, value]) => value && value === shortcut)?.[0];
      if (!id) return;
      const target = event.target as HTMLElement | null;
      const editable = target?.matches("input, textarea, select, [contenteditable=true]") ?? false;
      if (editable && !/^F\d{1,2}$/.test(event.key)) return;
      event.preventDefault();
      const route = routes[id];
      if (route) navigate({ to: route });
      else emitWorkspaceCommand(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, shortcuts]);

  const navigation = (iconOnly = false) => (
    <>
      <div className={`grid items-center gap-3 px-4 py-5 ${iconOnly ? "grid-cols-1 justify-items-center" : "grid-cols-[auto_minmax(0,1fr)] lg:px-5"}`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">{company?.logo ? <img src={company.logo} alt="" className="h-full w-full bg-card object-contain" /> : initials}</div>
        <div className={`min-w-0 ${iconOnly ? "hidden" : ""}`}>
          <p className="truncate font-display text-sm font-bold text-sidebar-foreground">{brand}</p>
          <p className="truncate text-[11px] font-medium text-sidebar-foreground/55">CRM · Accounts · Stock</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          const link = (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-11 items-center rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${iconOnly ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground/68 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"}`} />
              <span className={`min-w-0 truncate ${iconOnly ? "sr-only" : ""}`}>{label}</span>
            </Link>
          );
          return iconOnly ? <Tooltip key={to}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip> : link;
        })}
      </nav>
      <div className={`mx-3 mb-4 rounded-2xl border border-sidebar-border/70 bg-background/60 p-3 backdrop-blur-sm ${iconOnly ? "grid place-items-center" : ""}`} title={iconOnly ? "Database connected" : undefined}>
        <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><span className="h-2 w-2 shrink-0 rounded-full bg-accent" /><span className={iconOnly ? "sr-only" : ""}>Database connected</span></div>
        {!iconOnly && <p className="mt-1 text-[10px] leading-relaxed text-sidebar-foreground/50">Live records sync across every workspace.</p>}
      </div>
    </>
  );

  return (
    <TooltipProvider>
    <div className={`min-h-screen bg-background/70 ${invoiceEntry ? "invoice-app-shell" : ""}`}>
      {invoiceEntry && <header className="invoice-app-navigation grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-3">
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto"><Link to="/admin" className="shrink-0 px-2 font-display text-xs font-bold">{brand}</Link>{NAV.slice(0, 9).map(({to,label}) => <Button key={to} variant={pathname === to ? "secondary" : "ghost"} size="sm" asChild><Link to={to}>{label}</Link></Button>)}</nav>
        <div className="flex shrink-0 items-center"><WorkspaceSearch compact /><WorkspacePreferencesDialog /><Button variant="ghost" size="sm" asChild><Link to="/admin/profile">Admin</Link></Button></div>
      </header>}
      <aside data-app-navigation className={`fixed inset-y-4 left-4 z-30 hidden flex-col overflow-hidden rounded-3xl border border-sidebar-border/70 bg-sidebar text-sidebar-foreground shadow-[0_24px_60px_-36px_color-mix(in_oklab,var(--foreground)_45%,transparent)] backdrop-blur-xl transition-[width] duration-300 lg:flex ${collapsed ? "w-20" : "w-60"}`}>
        {navigation(collapsed)}
        <Button variant="outline" size="icon" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="absolute right-[-1px] top-16 rounded-r-none border-r-0" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
      </aside>

      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside data-app-navigation className={`fixed inset-y-3 left-3 z-50 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 lg:hidden ${menuOpen ? "translate-x-0" : "-translate-x-[110%]"}`}>
        <Button variant="ghost" size="icon" aria-label="Close navigation" className="absolute right-3 top-4 z-10 rounded-full" onClick={() => setMenuOpen(false)}><X /></Button>
        {navigation(false)}
      </aside>

      <header data-mobile-header className="sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Button variant="outline" size="icon" aria-label="Open navigation" className="shrink-0 rounded-full bg-card/80" onClick={() => setMenuOpen(true)}><Menu /></Button>
        <div className="min-w-0"><p className="truncate font-display text-sm font-bold">{current?.label}</p><p className="truncate text-[10px] text-muted-foreground">{brand}</p></div>
        <div className="flex shrink-0 items-center gap-1"><WorkspaceSearch compact /><WorkspacePreferencesDialog /><Button variant="outline" size="icon" aria-label="Notifications" className="shrink-0 rounded-full bg-card/80"><Bell /></Button></div>
      </header>

      <header className={`fixed right-6 top-4 z-20 hidden h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-2xl border border-border/60 bg-card/80 px-5 shadow-sm backdrop-blur-xl transition-[left] duration-300 lg:grid ${collapsed ? "left-28" : "left-72"}`}>
        <WorkspaceSearch />
        <div className="flex shrink-0 items-center gap-2"><WorkspacePreferencesDialog /><Button variant="ghost" size="icon" aria-label="Notifications" className="rounded-full"><Bell /></Button><Link to="/admin/profile" title="Profile & Companies" className="grid h-9 w-9 place-items-center rounded-full bg-accent/25 font-display text-xs font-bold text-accent-foreground">{initials}</Link></div>
      </header>

      <main data-app-main className={`min-w-0 px-4 pb-24 pt-5 transition-[margin] duration-300 sm:px-6 lg:px-6 lg:pb-10 lg:pt-24 ${collapsed ? "lg:ml-24" : "lg:ml-68"}`}>
        <div className="page-enter mx-auto w-full max-w-[1600px]">{children}</div>
      </main>

      <nav data-mobile-nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-border/70 bg-card/90 p-1.5 shadow-xl backdrop-blur-xl lg:hidden">
        {NAV.slice(0, 5).map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return <Link key={to} to={to} aria-label={label} className={`flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-semibold ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Icon className="h-4 w-4" /><span className="max-w-full truncate px-1">{label}</span></Link>;
        })}
      </nav>
    </div>
    </TooltipProvider>
  );
}
