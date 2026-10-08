import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { matchesSearch } from "./search";

export const SHOP_CATEGORIES = ["Electricals", "Electronics", "Hardware"] as const;
export type ShopProduct = { id: string; company_id: string; name: string; sku: string; unit: string; price: number; mrp: number; quantity: number; category: string; description: string; image_url: string; company_name: string };
export type CartLine = { product: ShopProduct; quantity: number };
export const checkoutSchema = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().regex(/^[+\d ()-]{7,20}$/, "Enter a valid phone number"), address: z.string().trim().min(5).max(1000), notes: z.string().trim().max(1000) });

export function filterShopProducts(products: ShopProduct[], search: string, category: string) {
  return products.filter(p => (category === "All" || p.category === category) && matchesSearch(search, p.name, p.sku, p.category, p.description, p.company_name));
}
export function cartTotal(lines: CartLine[]) { return Math.round(lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0) * 100) / 100; }
export function canAddToCart(lines: CartLine[], product: ShopProduct) {
  return Number(product.quantity) > (lines.find(line => line.product.id === product.id)?.quantity ?? 0) && (!lines.length || lines[0]?.product.company_id === product.company_id);
}
export const ORDER_TRANSITIONS: Record<string, string[]> = { new: ["confirmed", "cancelled"], confirmed: ["ready", "cancelled"], ready: ["completed", "cancelled"], completed: [], cancelled: [] };

export async function fetchShopProducts(sb: SupabaseClient): Promise<ShopProduct[]> {
  // The RPC returns one JSON array, not a paginated table result.
  const { data, error } = await sb.rpc("online_catalog");
  if (error) throw new Error("The online catalogue is not available yet. Please check back shortly.");
  return (data ?? []) as ShopProduct[];
}
export async function uploadShopPhoto(sb: SupabaseClient, companyId: string, file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP photo");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${companyId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await sb.storage.from("online-products").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Photo upload failed. Check that the online-products image storage is set up and try again.");
  return { path, url: sb.storage.from("online-products").getPublicUrl(path).data.publicUrl };
}