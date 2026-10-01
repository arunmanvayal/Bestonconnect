import { useState } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMMANDS, normalizeShortcut, useWorkspacePreferences, type CommandId, type Density } from "@/lib/workspace-preferences";

export function WorkspacePreferencesDialog() {
  const { density, shortcuts, setDensity, setShortcut, resetShortcuts } = useWorkspacePreferences();
  const [open, setOpen] = useState(false);

  const assign = (id: CommandId, shortcut: string) => {
    if (!shortcut) return;
    const duplicate = COMMANDS.find((command) => command.id !== id && shortcuts[command.id] === shortcut);
    if (duplicate) {
      toast.error(`${shortcut} is already assigned to ${duplicate.label}`);
      return;
    }
    setShortcut(id, shortcut);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Workspace preferences" title="Workspace preferences" className="rounded-full"><SettingsIcon /></Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workspace preferences</DialogTitle>
          <DialogDescription>Adjust entry spacing and keyboard shortcuts on this device.</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <div><h3 className="font-display text-sm font-semibold">Entry density</h3><p className="text-xs text-muted-foreground">Changes rows, fields, and table spacing across entry screens.</p></div>
          <Tabs value={density} onValueChange={(value) => setDensity(value as Density)}>
            <TabsList className="grid h-auto w-full grid-cols-3">
              {(["compact", "standard", "spacious"] as Density[]).map((value) => <TabsTrigger key={value} value={value} className="capitalize">{value}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-display text-sm font-semibold">Keyboard shortcuts</h3><p className="text-xs text-muted-foreground">Select a field, then press the key combination you want.</p></div>
            <Button variant="outline" size="sm" onClick={resetShortcuts}><RotateCcw />Reset</Button>
          </div>
          {(["Actions", "Navigation"] as const).map((group) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{group}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {COMMANDS.filter((command) => command.group === group).map((command) => (
                  <label key={command.id} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{command.label}</span>
                    <span className="relative">
                      <Keyboard className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        aria-label={`${command.label} shortcut`}
                        className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-center text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"
                        value={shortcuts[command.id]}
                        readOnly
                        onKeyDown={(event) => {
                          event.preventDefault();
                          if (event.key === "Backspace" || event.key === "Delete") setShortcut(command.id, "");
                          else assign(command.id, normalizeShortcut(event));
                        }}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.09A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.01V3h4v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>;
}