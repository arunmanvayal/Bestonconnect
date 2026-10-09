import { createContext, useContext, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export type Density = "compact" | "standard" | "spacious";
import { DEFAULT_SHORTCUTS, mergeShortcuts, type CommandId } from "@/lib/workspace-commands";
export { COMMANDS, DEFAULT_SHORTCUTS, type CommandId } from "@/lib/workspace-commands";

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
          shortcuts: mergeShortcuts(parsed.shortcuts),
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