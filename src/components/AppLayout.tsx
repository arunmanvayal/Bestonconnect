import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LayoutDashboard, Users, BookOpen, Wallet, Package, Settings2, ShoppingCart, Truck, HandCoins, Undo2, UserCircle, BarChart3, Wrench } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspacePreferencesDialog } from "@/components/WorkspacePreferencesDialog";
import { WorkspaceSearch } from "@/components/WorkspaceSearch";
import { AdminNavigation } from "@/components/AdminNavigation";
import { useActiveCompany } from "@/lib/company";
import { emitWorkspaceCommand, normalizeShortcut, useWorkspacePreferences, type CommandId } from "@/lib/workspace-preferences";
import { commandDestination } from "@/lib/workspace-commands";

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
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/masters", label: "Masters", icon: Settings2 },
  { to: "/admin/online-products", label: "Online Products", icon: Package },
  { to: "/admin/online-orders", label: "Online Orders", icon: ShoppingCart },
  { to: "/admin/online-shop", label: "Online Shop", icon: ShoppingCart },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/tools", label: "Tools", icon: Wrench },
  { to: "/admin/profile", label: "Profile & Companies", icon: UserCircle },
  { to: "/admin/setup", label: "Setup", icon: Settings2 },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();
  const { shortcuts } = useWorkspacePreferences();
  const { data: company } = useActiveCompany();
  const brand = company?.name ?? "BusinessDesk";
  const current = NAV.find(item => item.to === pathname) ?? NAV[0];
  const invoiceEntry = pathname === "/admin/sales" || pathname === "/admin/purchase";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      const shortcut = normalizeShortcut(event);
      const id = (Object.entries(shortcuts) as Array<[CommandId, string]>).find(([, value]) => value && value === shortcut)?.[0];
      if (!id) return;
      const target = event.target as HTMLElement | null;
      const editable = target?.matches("input, textarea, select, [contenteditable=true]") ?? false;
      if (editable && !/^F\d{1,2}$/.test(event.key)) return;
      event.preventDefault();
      const destination = commandDestination(id);
      if (destination) void navigate(destination);
      else emitWorkspaceCommand(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, shortcuts]);

  return <TooltipProvider>
    <div className={`min-h-screen bg-card ${invoiceEntry ? "invoice-app-shell" : ""}`}>
      <header data-app-navigation className="admin-workspace-navigation invoice-app-navigation sticky top-0 z-30 flex items-center bg-primary text-primary-foreground">
        <AdminNavigation />
        <div className="flex shrink-0 items-center border-l border-primary-foreground/20 px-1"><WorkspaceSearch compact /><WorkspacePreferencesDialog /></div>
      </header>
      {!invoiceEntry && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 sm:px-6">
        <div className="min-w-0"><p className="truncate text-xs font-semibold">{current.label}</p><p className="truncate text-[11px] text-muted-foreground">{brand}</p></div>
        <Link to="/admin/profile" title="Profile & Companies" className="grid h-8 w-8 place-items-center overflow-hidden rounded-sm border border-border bg-card font-display text-xs font-bold">{company?.logo ? <img src={company.logo} alt={brand} className="h-full w-full object-contain" /> : brand.slice(0,2).toUpperCase()}</Link>
      </div>}
      <main data-app-main className="min-w-0 px-4 py-5 sm:px-6">
        <div className="page-enter mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  </TooltipProvider>;
}
