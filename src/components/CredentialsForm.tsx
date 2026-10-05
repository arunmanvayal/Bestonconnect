import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useSupabase } from "@/lib/supabase";
import { USERNAME_RE } from "@/components/SupabaseGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Change username and/or password for the signed-in (or recovering) user. */
export function CredentialsForm({ userId, requireCurrent, onDone }: { userId: string; requireCurrent: boolean; onDone?: () => void }) {
  const sb = useSupabase()!;
  const [username, setUsername] = useState("");
  const [original, setOriginal] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.from("profiles").select("username").eq("user_id", userId).maybeSingle().then(({ data }) => {
      setUsername(data?.username ?? ""); setOriginal(data?.username ?? "");
    });
  }, [sb, userId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = username.trim().toLowerCase();
      if (u !== original) {
        if (!USERNAME_RE.test(u)) throw new Error("Username: 3–30 letters, numbers, _ or .");
        const { data: free } = await sb.rpc("username_available", { _username: u });
        if (!free) throw new Error("That username is taken");
        const { error } = await sb.from("profiles").upsert({ user_id: userId, username: u });
        if (error) throw error;
        setOriginal(u);
      }
      if (password) {
        if (password.length < 6) throw new Error("New password must be at least 6 characters");
        const { error } = await sb.auth.updateUser(requireCurrent ? ({ password, current_password: current } as any) : { password });
        if (error) throw error;
        setPassword(""); setCurrent("");
      }
      toast.success("Login details updated");
      onDone?.();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div><Label className="mb-1.5 block text-xs">Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} autoComplete="username" /></div>
      {requireCurrent && <div><Label className="mb-1.5 block text-xs">Current password</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></div>}
      <div><Label className="mb-1.5 block text-xs">New password (leave blank to keep)</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
      <div className="flex items-end sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Update login"}</Button></div>
    </form>
  );
}
