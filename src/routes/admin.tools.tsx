import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, FileSpreadsheet, Users, Truck, BookOpen, Package } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { INVOICE_QUERY_KEYS } from "@/lib/books";
import { DATASET_LABEL, detectDataset, downloadTemplate, exportDataset, importRows, readSheet, type Dataset, type ImportResult } from "@/lib/data-transfer";

export const Route = createFileRoute("/admin/tools")({
  head: () => ({
    meta: [
      { title: "Import & Export Tools — BusinessDesk" },
      { name: "description", content: "Export and import customers, vendors, ledgers and products as Excel files." },
      { property: "og:title", content: "Import & Export Tools — BusinessDesk" },
      { property: "og:description", content: "Export and import customers, vendors, ledgers and products as Excel files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppLayout><SupabaseGate><ToolsInner /></SupabaseGate></AppLayout>,
});

const EXPORTS: Array<{ id: Dataset; icon: typeof Users }> = [
  { id: "customers", icon: Users }, { id: "vendors", icon: Truck }, { id: "ledgers", icon: BookOpen }, { id: "products", icon: Package },
];
const IMPORTS: Dataset[] = ["customers", "vendors", "products"];

function ToolsInner() {
  const sb = useSupabase()!;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState<Dataset>("products");
  const [pending, setPending] = useState<{ name: string; rows: Record<string, unknown>[]; headers: string[] } | null>(null);
  const [update, setUpdate] = useState(true);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const doExport = async (d: Dataset) => {
    setBusy(d);
    try { const n = await exportDataset(sb, d); toast.success(`Exported ${n} ${DATASET_LABEL[d].toLowerCase()} records`); }
    catch (e: any) { toast.error(e.message ?? "Export failed"); }
    finally { setBusy(null); }
  };

  const pickFile = async (file?: File) => {
    if (!file) return;
    try {
      const sheet = await readSheet(file);
      const kind = detectDataset(sheet.headers);
      if (!kind) { toast.error("Columns not recognised. Use the Product or Customer/Vendor format."); return; }
      if (kind === "products" && target !== "products") setTarget("products");
      if (kind === "customers" && target === "products") setTarget(/vendor/i.test(file.name) ? "vendors" : "customers");
      setPending({ name: file.name, ...sheet }); setResult(null); setProgress(0);
    } catch { toast.error("Could not read that file"); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const runImport = async () => {
    if (!pending) return;
    setBusy("import");
    try {
      const r = await importRows(sb, target, pending.rows, update, (d, t) => setProgress(Math.round((d / t) * 100)));
      setResult(r); setProgress(100);
      INVOICE_QUERY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success(`Imported: ${r.inserted} new, ${r.updated} updated, ${r.skipped} skipped`);
    } catch (e: any) { toast.error(e.message ?? "Import failed — run the latest Setup script first"); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Tools</h1>
        <p className="text-sm text-muted-foreground">Move data in and out with Excel files in your existing format.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Export</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {EXPORTS.map(({ id, icon: Icon }) => (
              <Button key={id} variant="outline" className="justify-start" disabled={!!busy} onClick={() => doExport(id)}>
                <Icon /> {DATASET_LABEL[id]} {busy === id && <span className="ml-auto text-xs text-muted-foreground">Preparing…</span>}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Import</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {IMPORTS.map((d) => (
                <Button key={d} size="sm" variant={target === d ? "default" : "outline"} onClick={() => setTarget(d)} disabled={busy === "import"}>{DATASET_LABEL[d]}</Button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => fileRef.current?.click()} disabled={busy === "import"}><FileSpreadsheet /> Choose Excel file</Button>
              <Button variant="ghost" onClick={() => downloadTemplate(target)}>Download blank template</Button>
            </div>
            {pending && (
              <div className="space-y-3 rounded-xl border bg-muted/40 p-3 text-sm">
                <p><strong>{pending.name}</strong> — {pending.rows.length} rows, importing as <strong>{DATASET_LABEL[target]}</strong></p>
                <p className="text-xs text-muted-foreground">Columns: {pending.headers.join(", ")}</p>
                <div className="flex items-center gap-2">
                  <Switch id="upd" checked={update} onCheckedChange={setUpdate} />
                  <Label htmlFor="upd">Update records that already exist (matched by {target === "products" ? "barcode or item code" : "name"})</Label>
                </div>
                {busy === "import" || result ? <Progress value={progress} /> : null}
                {result && <p className="text-xs">{result.inserted} added · {result.updated} updated · {result.skipped} skipped</p>}
                <Button onClick={runImport} disabled={busy === "import"}>{busy === "import" ? `Importing ${progress}%` : "Start import"}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
