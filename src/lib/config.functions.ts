import { createServerFn } from "@tanstack/react-start";

// Returns the external Supabase project config (URL + publishable anon key).
// The anon key is public by design; values live in the project's secret store.
export const getSupabaseConfig = createServerFn({ method: "GET" }).handler(
  async () => ({
    url: process.env["EXTERNAL_SUPABASE_URL"] ?? "",
    anonKey: process.env["EXTERNAL_SUPABASE_ANON_KEY"] ?? "",
  }),
);
