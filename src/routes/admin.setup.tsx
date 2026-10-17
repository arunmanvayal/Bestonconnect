import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { setupScripts, numberedSetupSql } from "@/lib/setup-scripts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [
      { title: "Database Setup — BusinessDesk" },
      { name: "description", content: "Numbered database setup updates for BusinessDesk invoices, stock, companies and online orders." },
      { property: "og:title", content: "Database Setup — BusinessDesk" },
      { property: "og:description", content: "Numbered database setup updates for BusinessDesk invoices, stock, companies and online orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = async (script: typeof setupScripts[number]) => {
    try {
      await navigator.clipboard.writeText(numberedSetupSql(script));
      setCopied(script.number);
      setTimeout(() => setCopied(current => current === script.number ? null : current), 2000);
    } catch { toast.error("Could not copy. Download the SQL file instead."); }
  };
  const download = (script: typeof setupScripts[number]) => {
    const url = URL.createObjectURL(new Blob([numberedSetupSql(script)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `setup-${String(script.number).padStart(2,"0")}-${script.title.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.sql`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <AppLayout>
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Database Setup</h1>
        <p className="text-sm text-muted-foreground">New database: run 01–14 in order before using the app. Existing database: run only missing steps after their prerequisites.</p>
        <p className="text-sm text-muted-foreground">Logo and favicon update: run 14 once if previous steps are installed. It shares only the first company's logo with the public shop.</p>
        <p className="text-sm text-muted-foreground">Open your connected database’s SQL Editor, paste one complete script, and run it. Stop if a step reports an error.</p>
      </header>
      <div className="divide-y divide-border border-y border-border">
        {setupScripts.map(script => <section key={script.number} className="space-y-3 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{String(script.number).padStart(2,"0")} — {script.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{script.change}</p>
              <p className="mt-1 text-xs text-muted-foreground">{script.number === 1 ? "New database only; continue through all steps." : `Requires steps 01–${String(script.number-1).padStart(2,"0")} already installed.`}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => void copy(script)}>{copied === script.number ? <Check/> : <Copy/>}{copied === script.number ? "Copied" : "Copy SQL"}</Button>
              <Button size="icon" variant="outline" title={`Download setup ${script.number}`} aria-label={`Download setup ${script.number}`} onClick={() => download(script)}><Download/></Button>
            </div>
          </div>
          <details><summary className="cursor-pointer text-sm text-primary">View SQL</summary><pre className="mt-3 max-h-80 overflow-auto rounded-md bg-muted p-4 text-xs text-foreground">{numberedSetupSql(script)}</pre></details>
        </section>)}
      </div>
    </div>
  </AppLayout>;
}
