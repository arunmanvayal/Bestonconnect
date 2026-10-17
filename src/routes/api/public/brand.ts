import { createFileRoute } from "@tanstack/react-router";
import { fetchPublicBrand } from "@/lib/shop-brand";

export const Route = createFileRoute("/api/public/brand")({
  server: { handlers: { GET: async () => {
    try {
      const brand = await fetchPublicBrand(process.env["EXTERNAL_SUPABASE_URL"] ?? "", process.env["EXTERNAL_SUPABASE_ANON_KEY"] ?? "");
      return Response.json(brand, { headers: { "Cache-Control": "public, max-age=60" } });
    } catch { return Response.json({ logo: "" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  } } },
});