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
export { USERNAME_RE };

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

const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

function AuthForm() {
  const sb = useSupabase()!;
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [login, setLogin] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        let loginEmail = login.trim();
        if (!loginEmail.includes("@")) {
          const { data, error } = await sb.rpc("login_email", { _username: loginEmail, _password: password });
          if (error) throw new Error("Username login isn't set up yet — run the latest Setup script, or sign in with your email.");
          if (!data) throw new Error("Wrong username or password");
          loginEmail = data as string;
        }
        const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "Wrong username or password" : error.message);
      } else if (mode === "signup") {
        const u = username.trim().toLowerCase();
        if (!USERNAME_RE.test(u)) throw new Error("Username: 3–30 letters, numbers, _ or .");
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        const { data: free, error: e1 } = await sb.rpc("username_available", { _username: u });
        if (e1) throw new Error("Run the latest Setup script first");
        if (!free) throw new Error("That username is taken");
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { username: u } } });
        if (error) throw error;
        if (!data.session) setSent(`We sent a confirmation link to ${email}. Open it, then sign in with your username.`);
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent(`If ${email} has an account, a reset link is on its way. Use it to set a new username and password.`);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "signin" ? "Sign in to BusinessDesk" : mode === "signup" ? "Create your owner account" : "Reset username or password";

  return (
    <Card className="mx-auto mt-6 w-full max-w-md">
      <CardHeader>
        <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><LogIn className="h-5 w-5" /></div>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{mode === "forgot" ? "Enter the email you signed up with." : "One login, many companies — each with its own separate books."}</p>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-3 text-sm">
            <p>{sent}</p>
            <Button variant="outline" onClick={() => { setSent(null); setMode("signin"); }}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === "signin" && <Input required placeholder="Username or email" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />}
            {mode === "signup" && <Input required placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={30} />}
            {mode !== "signin" && <Input type="email" required placeholder={mode === "signup" ? "Email (for account recovery)" : "Email"} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
            {mode !== "forgot" && <Input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              <button type="button" className="hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create an account" : "Back to sign in"}
              </button>
              {mode === "signin" && <button type="button" className="hover:text-foreground" onClick={() => setMode("forgot")}>Forgot username or password?</button>}
            </div>
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
