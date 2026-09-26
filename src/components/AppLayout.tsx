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
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase", icon: Truck },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/ledger", label: "Ledger", icon: BookOpen },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/setup", label: "Setup", icon: Settings2 },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            B
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">BusinessDesk</p>
            <p className="text-xs text-sidebar-foreground/60">CRM & Accounts</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="px-5 py-4 text-xs text-sidebar-foreground/50">
          Connected to your Supabase
        </p>
      </aside>
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
