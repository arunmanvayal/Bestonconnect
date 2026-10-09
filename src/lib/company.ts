import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useSupabase } from "./supabase";
import { sessionIdentityChanged } from "./session-refresh";

export type Company = {
  id: string; owner_id: string; name: string; logo: string; tagline: string; address: string; state: string;
  gstin: string; phone: string; email: string; website: string; bank_name: string; account_name: string;
  account_no: string; ifsc: string; upi: string; terms: string; signature_label: string;
};

export const COMPANY_FIELDS: Array<{ key: keyof Company; label: string; multiline?: boolean; group: "business" | "bank" | "invoice" }> = [
  { key: "name", label: "Company name", group: "business" },
  { key: "tagline", label: "Tagline", group: "business" },
  { key: "gstin", label: "GSTIN", group: "business" },
  { key: "phone", label: "Phone", group: "business" },
  { key: "email", label: "Email", group: "business" },
  { key: "website", label: "Website", group: "business" },
  { key: "state", label: "State", group: "business" },
  { key: "address", label: "Address", multiline: true, group: "business" },
  { key: "bank_name", label: "Bank name", group: "bank" },
  { key: "account_name", label: "Account name", group: "bank" },
  { key: "account_no", label: "Account number", group: "bank" },
  { key: "ifsc", label: "IFSC", group: "bank" },
  { key: "upi", label: "UPI ID", group: "bank" },
  { key: "signature_label", label: "Signature label", group: "invoice" },
  { key: "terms", label: "Terms & conditions", multiline: true, group: "invoice" },
];

/** Current login session from the connected database (null = signed out, undefined = loading). */
export function useSession(): Session | null | undefined {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const identity = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!sb) return;
    let alive = true;

    const receive = (s: Session | null) => {
      if (!alive) return;
      const nextId = s?.user.id ?? null;
      if (sessionIdentityChanged(identity.current, nextId)) {
        qc.clear();
      }
      identity.current = nextId;
      setSession(s);
    };

    sb.auth.getSession().then(({ data }) => {
      if (identity.current === undefined) receive(data.session);
    });

    const { data } = sb.auth.onAuthStateChange((_event, s) => {
      receive(s);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [sb, qc]);

  return session;
}

export async function fetchActiveCompany(sb: SupabaseClient): Promise<Company | null> {
  const { data: s, error } = await sb.from("user_settings").select("active_company_id").maybeSingle();
  if (error) throw error;
  if (s?.active_company_id) {
    const { data: c } = await sb.from("companies").select("*").eq("id", s.active_company_id).maybeSingle();
    if (c) return c as Company;
  }
  // Fall back to the first company and make it active
  const { data: first } = await sb.from("companies").select("*").order("created_at").limit(1).maybeSingle();
  if (first) await sb.from("user_settings").upsert({ active_company_id: first.id });
  return (first as Company) ?? null;
}

export function useActiveCompany() {
  const sb = useSupabase();
  const session = useSession();
  return useQuery({
    queryKey: ["active-company", session?.user.id],
    queryFn: () => {
      if (!sb) throw new Error("Database connection is unavailable");
      return fetchActiveCompany(sb);
    },
    enabled: !!sb && !!session,
    staleTime: Infinity, // Keep company data stable
  });
}

export async function createCompany(sb: SupabaseClient, name: string, isFirst: boolean) {
  const { data, error } = await sb.from("companies").insert({ name }).select("id").single();
  if (error) throw error;
  const { error: e2 } = await sb.from("user_settings").upsert({ active_company_id: data.id });
  if (e2) throw e2;
  if (isFirst) await sb.rpc("claim_unassigned_data", { _company: data.id });
  return data.id as string;
}

export async function switchCompany(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("user_settings").upsert({ active_company_id: id });
  if (error) throw error;
}

/** Shrinks an uploaded logo to a small PNG data URL so it can be saved with the company. */
export function logoToDataUrl(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function two(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`; }
function three(n: number) { const h = Math.floor(n / 100), r = n % 100; return [h ? `${ONES[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" "); }
function intWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${intWords(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return parts.join(" ");
}
/** Indian-style amount in words, e.g. "Rupees One Thousand Two Hundred and Fifty Paise Only". */
export function amountInWords(amount: number) {
  const a = Math.abs(Number(amount) || 0);
  const rupees = Math.floor(a);
  const paise = Math.round((a - rupees) * 100);
  return `Rupees ${intWords(rupees)}${paise ? ` and ${two(paise)} Paise` : ""} Only`;
}
