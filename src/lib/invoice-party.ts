import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kind } from "@/lib/books";
import { fetchActiveCompany } from "@/lib/company";

export const EMPTY_PARTY = { name: "", code: "", company: "", phone: "", email: "", address: "", gstin: "", area: "", notes: "" };
export type PartyDraft = typeof EMPTY_PARTY;
export type InvoiceParty = PartyDraft & { id: string; party_type?: string; contact_no?: string };
export const invoicePartyType = (kind: Kind) => kind === "purchase" ? "supplier" : "customer";

export function partyPayload(kind: Kind, draft: PartyDraft, companyId: string) {
  if (!companyId) throw new Error("Select a company before saving.");
  const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) as PartyDraft;
  if (!values.name) throw new Error("Name is required.");
  return { ...values, party_type: invoicePartyType(kind), company_id: companyId, contact_no: values.phone };
}

export async function saveInvoiceParty(sb: SupabaseClient, kind: Kind, draft: PartyDraft): Promise<InvoiceParty> {
  const company = await fetchActiveCompany(sb);
  const payload = partyPayload(kind, draft, company?.id ?? "");
  const { data: existing, error: lookupError } = await sb.from("customers").select("id")
    .eq("company_id", payload.company_id).eq("party_type", payload.party_type)
    .ilike("name", payload.name.replace(/[\\%_]/g, "\\$&")).limit(1);
  if (lookupError) throw lookupError;
  if (existing?.length) throw new Error(`A ${payload.party_type} with this name already exists. Select it from the list.`);
  const { data, error } = await sb.from("customers").insert(payload).select("*").single();
  if (error) throw error;
  return data as InvoiceParty;
}