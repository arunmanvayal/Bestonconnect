import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, LogIn } from "lucide-react";
import { useSupabase } from "@/lib/supabase";
import { createCompany, useActiveCompany, useSession } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Loading({ text }: { text: string }) {
  return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

/** Waits for the database, then requires login and an active company before showing the page. */
export function SupabaseGate({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const session = useSession();
  const company = useActiveCompany();

  if (!supabase || session === undefined) return <Loading text="Connecting to your database…" />;
  if (!session) return <AuthForm />;
  if (company.isLoading) return <Loading text="Loading your company…" />;
  if (company.error) {
    return (
      <Card className="mx-auto mt-10 max-w-lg">
        <CardHeader><CardTitle className="text-base">One more setup step</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Company accounts aren't set up in your database yet. Run the latest setup script once, then refresh.</p>
          <Button asChild><Link to="/setup">Open setup script</Link></Button>
        </CardContent>
      </Card>
    );
  }
  if (!company.data) return <FirstCompany />;
  return <>{children}</>;
}

function AuthForm() {
  const sb = useSupabase()!;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setSent(true);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto mt-6 w-full max-w-md">
      <CardHeader>
        <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><LogIn className="h-5 w-5" /></div>
        <CardTitle>{mode === "signin" ? "Sign in to BusinessDesk" : "Create your owner account"}</CardTitle>
        <p className="text-sm text-muted-foreground">One login, many companies — each with its own separate books.</p>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-3 text-sm">
            <p>We sent a confirmation link to <strong>{email}</strong>. Open it, then come back and sign in.</p>
            <Button variant="outline" onClick={() => { setSent(false); setMode("signin"); }}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
            <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function FirstCompany() {
  const sb = useSupabase()!;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createCompany(sb, name.trim(), true);
      qc.clear();
      toast.success("Company created");
    } catch (err: any) {
      toast.error(err.message ?? "Could not create company");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mx-auto mt-6 w-full max-w-md">
      <CardHeader>
        <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2 className="h-5 w-5" /></div>
        <CardTitle>Create your first company</CardTitle>
        <p className="text-sm text-muted-foreground">Existing records will be moved into this company. Add logo, GST and bank details later on the Profile page.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Input required placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create company"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}
