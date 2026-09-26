import type { ReactNode } from "react";
import { useSupabase } from "@/lib/supabase";

/** Shows a loading state until the Supabase client is ready. */
export function SupabaseGate({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  if (!supabase) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Connecting to your database…
      </div>
    );
  }
  return <>{children}</>;
}

export function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}
