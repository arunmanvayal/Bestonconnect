import { createContext, useContext, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export type Density = "compact" | "standard" | "spacious";
export type CommandId =
  | "save" | "addRow" | "removeRow" | "print" | "refresh" | "focusProduct"
  | "navDashboard" | "navSales" | "navPurchase" | "navCustomers" | "navAccounts"
  | "navPayments" | "navReturns" | "navLedger" | "navStock" | "navReports";

export const COMMANDS: Array<{ id: CommandId; label: string; group: "Actions" | "Navigation" }> = [
  { id: "save", label: "Save", group: "Actions" },
  { id: "addRow", label: "Add row", group: "Actions" },
  { id: "removeRow", label: "Remove row", group: "Actions" },
  { id: "print", label: "Print", group: "Actions" },
  { id: "refresh", label: "Refresh", group: "Actions" },
  { id: "focusProduct", label: "Focus product search", group: "Actions" },
  { id: "navDashboard", label: "Open Dashboard", group: "Navigation" },
  { id: "navSales", label: "Open Sales", group: "Navigation" },
  { id: "navPurchase", label: "Open Purchase", group: "Navigation" },
  { id: "navCustomers", label: "Open Customers", group: "Navigation" },
  { id: "navAccounts", label: "Open Accounts", group: "Navigation" },
  { id: "navPayments", label: "Open Receipts & Payments", group: "Navigation" },
  { id: "navReturns", label: "Open Sales Returns", group: "Navigation" },
  { id: "navLedger", label: "Open Ledger", group: "Navigation" },
  { id: "navStock", label: "Open Stock", group: "Navigation" },
  { id: "navReports", label: "Open Reports", group: "Navigation" },
];

export const DEFAULT_SHORTCUTS: Record<CommandId, string> = {
  save: "F12", addRow: "Ctrl+Enter", removeRow: "Ctrl+Backspace", print: "Ctrl+Shift+P",
  refresh: "Ctrl+Shift+R", focusProduct: "Alt+F",
  navDashboard: "Alt+1", navSales: "Alt+2", navPurchase: "Alt+3", navCustomers: "Alt+4",
  navAccounts: "Alt+5", navPayments: "Alt+6", navReturns: "Alt+7", navLedger: "Alt+8",
  navStock: "Alt+9", navReports: "Alt+0",
};

type ColumnWidths = Record<string, number[]>;
type Preferences = {
  collapsed: boolean;
  density: Density;
  shortcuts: Record<CommandId, string>;
  columnWidths: ColumnWidths;
};

const DEFAULTS: Preferences = { collapsed: false, density: "standard", shortcuts: DEFAULT_SHORTCUTS, columnWidths: {} };
const STORAGE_KEY = "businessdesk.workspace.preferences.v1";

type PreferencesContextValue = Preferences & {
  ready: boolean;
  setCollapsed: (value: boolean) => void;
  setDensity: (value: Density) => void;
  setShortcut: (id: CommandId, value: string) => void;
  setColumnWidths: (key: string, value: number[]) => void;
  resetShortcuts: () => void;
  resetColumnWidths: (key: string) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function WorkspacePreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Preferences>;
        setPrefs({
          ...DEFAULTS,
          ...parsed,
          shortcuts: { ...DEFAULT_SHORTCUTS, ...(parsed.shortcuts ?? {}) },
          columnWidths: parsed.columnWidths ?? {},
        });
      }
    } catch {
      // Keep safe defaults when browser storage is unavailable or malformed.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs, ready]);

  const value = useMemo<PreferencesContextValue>(() => ({
    ...prefs,
    ready,
    setCollapsed: (collapsed) => setPrefs((p) => ({ ...p, collapsed })),
    setDensity: (density) => setPrefs((p) => ({ ...p, density })),
    setShortcut: (id, shortcut) => setPrefs((p) => ({ ...p, shortcuts: { ...p.shortcuts, [id]: shortcut } })),
    setColumnWidths: (key, widths) => setPrefs((p) => ({ ...p, columnWidths: { ...p.columnWidths, [key]: widths } })),
    resetShortcuts: () => setPrefs((p) => ({ ...p, shortcuts: DEFAULT_SHORTCUTS })),
    resetColumnWidths: (key) => setPrefs((p) => {
      const columnWidths = { ...p.columnWidths };
      delete columnWidths[key];
      return { ...p, columnWidths };
    }),
  }), [prefs, ready]);

  return <PreferencesContext.Provider value={value}><div data-density={prefs.density}>{children}</div></PreferencesContext.Provider>;
}

export function useWorkspacePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("Workspace preferences must be used inside WorkspacePreferencesProvider");
  return value;
}

export function normalizeShortcut(event: KeyboardEvent | ReactKeyboardEvent) {
  const modifiers = [event.ctrlKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : "", event.metaKey ? "Meta" : ""].filter(Boolean);
  const raw = event.key === " " ? "Space" : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(raw)) return "";
  return [...modifiers, raw].join("+");
}

export function emitWorkspaceCommand(id: CommandId) {
  window.dispatchEvent(new CustomEvent("businessdesk:command", { detail: id }));
}

export function useWorkspaceCommands(handlers: Partial<Record<CommandId, () => void>>) {
  useEffect(() => {
    const listener = (event: Event) => {
      const id = (event as CustomEvent<CommandId>).detail;
      handlers[id]?.();
    };
    window.addEventListener("businessdesk:command", listener);
    return () => window.removeEventListener("businessdesk:command", listener);
  }, [handlers]);
}