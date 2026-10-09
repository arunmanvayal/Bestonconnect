import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Check, ImagePlus, LogOut, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { COMPANY_FIELDS, createCompany, logoToDataUrl, switchCompany, useActiveCompany, useSession, type Company } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CredentialsForm } from "@/components/CredentialsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Companies — BusinessDesk" },
      { name: "description", content: "Manage your owner login, switch between company accounts and set logo, address, GST and bank details." },
      { property: "og:title", content: "Profile & Companies — BusinessDesk" },
      { property: "og:description", content: "Manage your owner login, switch between company accounts and set logo, address, GST and bank details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <SupabaseGate>
        <ProfilePage />
      </SupabaseGate>
    </AppLayout>
  ),
});

function ProfilePage() {
  const sb = useSupabase()!;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const session = useSession();
  const { data: active } = useActiveCompany();
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await sb.from("companies").select("id, name, logo, gstin").order("created_at");
      if (error) throw error;
      return data as Pick<Company, "id" | "name" | "logo" | "gstin">[];
    },
  });
  const [form, setForm] = useState<Partial<Company>>({});
  const [newName, setNewName] = useState("");
  const initializedCompany = useRef<string | null>(null);
  useEffect(() => { if (active && initializedCompany.current !== active.id) { initializedCompany.current = active.id; setForm(active); } }, [active]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name?.trim()) throw new Error("Company name is required");
      const { id, owner_id, ...rest } = form as Company & { created_at?: string };
      delete (rest as any).created_at;
      const { error } = await sb.from("companies").update(rest).eq("id", active!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Company details saved"); qc.invalidateQueries({ queryKey: ["active-company"] }); qc.invalidateQueries({ queryKey: ["companies"] }); },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const doSwitch = async (id: string) => {
    try { await switchCompany(sb, id); qc.clear(); toast.success("Switched company"); } catch (e: any) { toast.error(e.message); }
  };
  const addCompany = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try { await createCompany(sb, newName.trim(), false); setNewName(""); qc.clear(); toast.success("New company created and opened"); } catch (err: any) { toast.error(err.message); }
  };
  const removeCompany = async (c: { id: string; name: string }) => {
    if (companies.length <= 1) { toast.error("You need at least one company"); return; }
    if (!window.confirm(`Delete "${c.name}" and ALL its records? This cannot be undone.`)) return;
    const { error } = await sb.from("companies").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    qc.clear(); toast.success("Company deleted");
  };
  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await sb.auth.signOut();
    navigate({ to: "/admin", replace: true });
  };
  const onLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    setForm((f) => ({ ...f, logo: "" }));
    const url = await logoToDataUrl(file);
    setForm((f) => ({ ...f, logo: url }));
  };

  const field = (g: "business" | "bank" | "invoice") => COMPANY_FIELDS.filter((f) => f.group === g).map((f) => (
    <div key={f.key} className={f.multiline ? "sm:col-span-2" : ""}>
      <Label className="mb-1.5 block text-xs">{f.label}</Label>
      {f.multiline
        ? <Textarea rows={3} value={(form[f.key] as string) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
        : <Input value={(form[f.key] as string) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
    </div>
  ));

  return (
    <div className="entry-workspace mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Profile & Companies</h1>
          <p className="text-sm text-muted-foreground">Signed in as {session?.user.email}. Each company keeps its own customers, bills, stock and ledger.</p>
        </div>
        <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Login details</CardTitle></CardHeader>
        <CardContent>{session && <CredentialsForm userId={session.user.id} requireCurrent />}</CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Your companies</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {companies.map((c) => {
              const isActive = c.id === active?.id;
              return (
                <div key={c.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-2.5 transition-colors ${isActive ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-muted">
                    {c.logo ? <img src={c.logo} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{c.name}</p><p className="truncate text-[11px] text-muted-foreground">{c.gstin || "No GSTIN"}</p></div>
                  <div className="flex gap-1">
                    {isActive ? <span className="grid h-8 w-8 place-items-center text-primary"><Check className="h-4 w-4" /></span>
                      : <Button size="sm" variant="outline" onClick={() => doSwitch(c.id)}>Open</Button>}
                    {!isActive && <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => removeCompany(c)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              );
            })}
            <form onSubmit={addCompany} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 pt-2">
              <Input placeholder="New company name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} />
              <Button type="submit"><Plus className="mr-1 h-4 w-4" />Add</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <CardTitle className="text-base">Details for {active?.name}</CardTitle>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save details"}</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border bg-muted">
                {form.logo ? <img src={form.logo} alt="Company logo" className="h-full w-full object-contain p-1" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="space-y-2">
                <Label className="block text-xs">Logo (shown on printed invoices)</Label>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm"><label className="cursor-pointer">Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} /></label></Button>
                  {form.logo && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, logo: "" })}>Remove</Button>}
                </div>
              </div>
            </div>
            <section><h3 className="mb-3 text-sm font-semibold">Business</h3><div className="grid gap-3 sm:grid-cols-2">{field("business")}</div></section>
            <section><h3 className="mb-3 text-sm font-semibold">Bank details</h3><div className="grid gap-3 sm:grid-cols-2">{field("bank")}</div></section>
            <section><h3 className="mb-3 text-sm font-semibold">Invoice footer</h3><div className="grid gap-3 sm:grid-cols-2">{field("invoice")}</div></section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
