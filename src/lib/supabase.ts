import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabaseConfig } from "./config.functions";

let client: SupabaseClient | null = null;
let pending: Promise<SupabaseClient | null> | null = null;
const CONFIG_KEY = "businessdesk.db-config";

export function initSupabase(url: string, anonKey: string) {
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "businessdesk.auth" },
    });
  }
  return client;
}

export function getSupabase(): SupabaseClient {
  if (!client) throw new Error("Supabase client not initialised yet");
  return client;
}

/** Connects once per tab: uses the saved connection instantly, refreshing it from the server in the background. */
function connect(): Promise<SupabaseClient | null> {
  if (client) return Promise.resolve(client);
  if (pending) return pending;
  let cached: { url: string; anonKey: string } | null = null;
  try { cached = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "null"); } catch { cached = null; }
  const fresh = getSupabaseConfig().then((cfg) => {
    if (cfg?.url && cfg?.anonKey) {
      try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
      return initSupabase(cfg.url, cfg.anonKey);
    }
    return client;
  });
  pending = cached?.url && cached?.anonKey ? Promise.resolve(initSupabase(cached.url, cached.anonKey)) : fresh;
  return pending;
}

/** React hook: returns a ready client (or null while the first connection is made). */
export function useSupabase(): SupabaseClient | null {
  const [ready, setReady] = useState<SupabaseClient | null>(client);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void connect().then((c) => { if (alive && c) setReady(c); });
    return () => { alive = false; };
  }, [ready]);
  return ready;
}
