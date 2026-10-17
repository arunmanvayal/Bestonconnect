import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { useSupabase } from "@/lib/supabase";
import { logoToDataUrl, useActiveCompany } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Upload or remove the active company's logo straight from the admin dashboard. */
export function BrandLogoCard() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { data: company } = useActiveCompany();
  const [busy, setBusy] = useState(false);

  const saveLogo = async (logo: string) => {
    if (!sb || !company) return;
    setBusy(true);
    const { error } = await sb.from("companies").update({ logo }).eq("id", company.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["active-company"] });
    void qc.invalidateQueries({ queryKey: ["companies"] });
    void qc.invalidateQueries({ queryKey: ["public-brand"] });
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(link => { link.href = `/api/public/brand-icon?v=${Date.now()}`; });
    toast.success(logo ? "Logo updated" : "Logo removed");
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    try { await saveLogo(await logoToDataUrl(file)); } catch { toast.error("Could not read that image"); }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border bg-muted">
          {company?.logo ? <img src={company.logo} alt="Company logo" className="h-full w-full object-contain p-1" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Brand logo</p>
          <p className="text-xs text-muted-foreground">Shown in the admin header and on printed invoices. The first company's logo also appears on the shop and browser icon after Setup 14.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" disabled={busy}><label className="cursor-pointer">{busy ? "Saving…" : "Upload logo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
          {company?.logo && <Button variant="outline" size="sm" disabled={busy} onClick={() => void saveLogo("")}>Remove</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
