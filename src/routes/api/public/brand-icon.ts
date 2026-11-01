import { createFileRoute } from "@tanstack/react-router";
import { fetchPublicBrand, logoIcon } from "@/lib/shop-brand";
import fallback from "../../../../public/favicon.svg?raw";

export async function brandIconResponse(request: Request) {
  const size = Math.min(512, Math.max(16, Number(new URL(request.url).searchParams.get("size")) || 96));
    try {
      const brand = await fetchPublicBrand(process.env["EXTERNAL_SUPABASE_URL"] ?? "", process.env["EXTERNAL_SUPABASE_ANON_KEY"] ?? "");
      const icon = logoIcon(brand.logo, size);
      if (icon) return new Response(new Uint8Array(icon).buffer, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
    } catch { /* Keep a usable fallback until the owner installs the branding update. */ }
    return new Response(fallback, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/public/brand-icon")({
  server: { handlers: { GET: ({ request }) => brandIconResponse(request) } },
});