import type { SupabaseClient } from "@supabase/supabase-js";

/** Read all RLS-visible records in a deterministic order before filtering. */
export async function fetchSearchRecords(sb: SupabaseClient, table: string, order: string, filter?: (query: any) => any) {
  const rows: any[] = [];
  for (let from = 0; ; from += 500) {
    let query = sb.from(table).select("*").order(order).order("id").range(from, from + 499);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}