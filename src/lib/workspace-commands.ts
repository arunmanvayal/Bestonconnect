export const COMMANDS = [
  { id: "save", label: "Save", group: "Actions", defaultShortcut: "F12" },
  { id: "addRow", label: "Add row / New entry", group: "Actions", defaultShortcut: "Ctrl+Enter" },
  { id: "removeRow", label: "Remove row", group: "Actions", defaultShortcut: "Ctrl+Backspace" },
  { id: "print", label: "Print", group: "Actions", defaultShortcut: "Ctrl+Shift+P" },
  { id: "refresh", label: "Refresh", group: "Actions", defaultShortcut: "Ctrl+Shift+R" },
  { id: "focusProduct", label: "Focus product search", group: "Actions", defaultShortcut: "Alt+F" },
  { id: "focusParty", label: "Focus party", group: "Actions", defaultShortcut: "F11" },
  { id: "navDashboard", label: "Admin Dashboard", group: "Navigation", defaultShortcut: "Alt+1", destination: { to: "/admin" } },
  { id: "navSales", label: "Sales / Retail Invoice", group: "Navigation", defaultShortcut: "Alt+2", destination: { to: "/admin/sales" } },
  { id: "navPurchase", label: "Purchase Invoice", group: "Navigation", defaultShortcut: "Alt+3", destination: { to: "/admin/purchase" } },
  { id: "navCustomers", label: "Customers & Suppliers", group: "Navigation", defaultShortcut: "Alt+4", destination: { to: "/admin/customers" } },
  { id: "navAccounts", label: "Accounts", group: "Navigation", defaultShortcut: "Alt+5", destination: { to: "/admin/accounts" } },
  { id: "navPayments", label: "Receipts & Payments", group: "Navigation", defaultShortcut: "Alt+6", destination: { to: "/admin/payments" } },
  { id: "navReturns", label: "Sales Returns", group: "Navigation", defaultShortcut: "Alt+7", destination: { to: "/admin/returns" } },
  { id: "navLedger", label: "Ledger", group: "Navigation", defaultShortcut: "Alt+8", destination: { to: "/admin/ledger" } },
  { id: "navStock", label: "Stock & Maintenance", group: "Navigation", defaultShortcut: "Alt+9", destination: { to: "/admin/stock" } },
  { id: "navReports", label: "Business Reports", group: "Navigation", defaultShortcut: "Alt+0", destination: { to: "/admin/reports" } },
  { id: "navProducts", label: "Products / Product Master", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/products" } },
  { id: "navMasters", label: "Masters", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "category" } } },
  { id: "navOnlineProducts", label: "Online Products", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/online-products" } },
  { id: "navOnlineOrders", label: "Online Orders", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/online-orders" } },
  { id: "navOnlineShop", label: "Online Shop", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/online-shop" } },
  { id: "navTools", label: "Tools / Import & Export", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/tools" } },
  { id: "navProfile", label: "Profile & Companies", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/profile" } },
  { id: "navSetup", label: "Setup", group: "Navigation", defaultShortcut: "", destination: { to: "/admin/setup" } },
  { id: "masterCategory", label: "Category", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "category" } } },
  { id: "masterManufacturer", label: "Manufacturer", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "manufacturer" } } },
  { id: "masterCustomer", label: "Customer", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "customer" } } },
  { id: "masterSupplier", label: "Supplier", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "supplier" } } },
  { id: "masterAccountGroup", label: "Account Group", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "account_group" } } },
  { id: "masterLedger", label: "Ledger", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "ledger" } } },
  { id: "masterArea", label: "Area", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "area" } } },
  { id: "masterEmployee", label: "Employee", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "employee" } } },
  { id: "masterCostCentre", label: "Cost Centre", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "cost_centre" } } },
  { id: "masterStoreLocation", label: "Store Location", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "store_location" } } },
  { id: "masterAgent", label: "Agent", group: "Masters", defaultShortcut: "", destination: { to: "/admin/masters", search: { kind: "agent" } } },
] as const;

export type CommandId = typeof COMMANDS[number]["id"];
export const DEFAULT_SHORTCUTS = Object.fromEntries(COMMANDS.map(command => [command.id, command.defaultShortcut])) as Record<CommandId, string>;

export function commandDestination(id: CommandId) {
  const command = COMMANDS.find(command => command.id === id);
  return command && "destination" in command ? command.destination : undefined;
}

export function mergeShortcuts(saved: Partial<Record<CommandId, string>> = {}): Record<CommandId, string> {
  return Object.fromEntries(COMMANDS.map(command => [command.id, typeof saved[command.id] === "string" ? saved[command.id] : command.defaultShortcut])) as Record<CommandId, string>;
}