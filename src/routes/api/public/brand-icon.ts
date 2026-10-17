import { createFileRoute } from "@tanstack/react-router";
import { fetchPublicBrand, logoIcon } from "@/lib/shop-brand";
import fallback from "../../../../public/favicon.svg?raw";

export const Route = createFileRoute("/api/public/brand-icon")({
  server: { handlers: { GET: async () => {
    try {
      const brand = await fetchPublicBrand(process.env["EXTERNAL_SUPABASE_URL"] ?? "", process.env["EXTERNAL_SUPABASE_ANON_KEY"] ?? "");
      const icon = logoIcon(brand.logo);
      if (icon) return new Response(new Uint8Array(icon).buffer, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
    } catch { /* Keep a usable fallback until the owner installs the branding update. */ }
    return new Response(fallback, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  } } },
});