import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseConfig } from "./config.functions";

let client: SupabaseClient | null = null;

export function initSupabase(url: string, anonKey: string) {
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function getSupabase(): SupabaseClient {
  if (!client) throw new Error("Supabase client not initialised yet");
  return client;
}

/** React hook: loads config from the server and returns a ready client (or null). */
export function useSupabase(): SupabaseClient | null {
  const { data } = useQuery({
    queryKey: ["supabase-config"],
    queryFn: () => getSupabaseConfig(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data?.url && data?.anonKey) initSupabase(data.url, data.anonKey);
  }, [data]);

  if (!data?.url || !data?.anonKey || !client) return null;
  return client;
}
