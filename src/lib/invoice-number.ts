import type { SupabaseClient } from "@supabase/supabase-js";

export function nextInvoiceNumber(numbers: string[], kind: "sale" | "purchase") {
  const prefix = kind === "sale" ? "RT" : "PI";
  const pattern = new RegExp(`^${prefix}(\\d+)$`, "i");
  let highest = 1000;
  for (const number of numbers) {
    const match = number.trim().match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}${highest + 1}`;
}

/** Read all visible company bills, not the recent-history count. */
export async function fetchNextInvoiceNumber(sb: SupabaseClient, kind: "sale" | "purchase") {
  const numbers: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.from("invoices").select("bill_no").eq("kind", kind).order("id").range(offset, offset + 999);
    if (error) throw error;
    numbers.push(...(data ?? []).map((bill) => String(bill.bill_no ?? "")));
    if (!data || data.length < 1000) return nextInvoiceNumber(numbers, kind);
  }
}