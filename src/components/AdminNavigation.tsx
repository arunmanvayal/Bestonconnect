import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, ShoppingCart, Undo2, Truck, Wallet, HandCoins, BookOpen, Package, BarChart3, Wrench, UserCircle, Settings2, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MastersMenu } from "@/components/MastersMenu";

const GROUPS = [
  { label: "Sales", items: [{ to: "/admin/sales", label: "Retail Invoice", icon: ShoppingCart }, { to: "/admin/returns", label: "Sales Returns", icon: Undo2 }] },
  { label: "Purchase", items: [{ to: "/admin/purchase", label: "Purchase Invoice", icon: Truck }] },
  { label: "Accounts", items: [{ to: "/admin/accounts", label: "Accounts", icon: Wallet }, { to: "/admin/payments", label: "Receipts & Payments", icon: HandCoins }, { to: "/admin/ledger", label: "Ledger", icon: BookOpen }] },
  { label: "Inventory", items: [{ to: "/admin/stock", label: "Stock & Maintenance", icon: Package }, { to: "/admin/products", label: "Products", icon: Package }] },
  { label: "Online", items: [{ to: "/admin/online-products", label: "Online Products", icon: Package }, { to: "/admin/online-orders", label: "Online Orders", icon: ShoppingCart }, { to: "/admin/online-shop", label: "Online Shop", icon: Store }] },
  { label: "Reports", items: [{ to: "/admin/reports", label: "Business Reports", icon: BarChart3 }] },
  { label: "Tools", items: [{ to: "/admin/tools", label: "Import & Export", icon: Wrench }, { to: "/admin/setup", label: "Setup", icon: Settings2 }] },
  { label: "Manage", items: [{ to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard }, { to: "/admin/customers", label: "Customers & Suppliers", icon: Users }, { to: "/admin/profile", label: "Profile & Companies", icon: UserCircle }] },
] as const;

export function AdminNavigation() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return <nav aria-label="Admin categories" className="admin-category-menu flex min-w-0 flex-1 items-center overflow-x-auto">
    <Button variant="ghost" size="icon" className="shrink-0" asChild><Link to="/admin" aria-label="Admin Dashboard" title="Admin Dashboard"><LayoutDashboard className="h-4 w-4" /></Link></Button>
    <MastersMenu />
    {GROUPS.map(group => <DropdownMenu key={group.label}>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="shrink-0" data-active={group.items.some(item => item.to === pathname)}>{group.label}<ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} className="min-w-52 rounded-sm">
        {group.items.map(({to, label, icon: Icon}) => <DropdownMenuItem key={to} asChild><Link to={to} aria-current={pathname === to ? "page" : undefined} className={pathname === to ? "bg-secondary font-semibold" : ""}><Icon />{label}</Link></DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>)}
  </nav>;
}