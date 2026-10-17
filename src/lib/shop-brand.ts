import { decode, encode } from "fast-png";

export const BRAND_ICON_URL = "/api/public/brand-icon";

/** Only locally encoded PNG uploads are accepted: no remote fetching or SVG execution. */
export function logoIcon(logo: string, size = 96): Uint8Array | null {
  if (!logo.startsWith("data:image/png;base64,") || logo.length > 2_000_000) return null;
  try {
    const bytes = Uint8Array.from(atob(logo.slice(22)), c => c.charCodeAt(0));
    const image = decode(bytes);
    if (image.depth !== 8 || image.width > 320 || image.height > 320 || ![3, 4].includes(image.channels)) return null;
    const scale = Math.min(size / image.width, size / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const left = Math.floor((size - width) / 2), top = Math.floor((size - height) / 2);
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const source = (Math.min(image.height - 1, Math.floor(y / scale)) * image.width + Math.min(image.width - 1, Math.floor(x / scale))) * image.channels;
      const dest = ((y + top) * size + x + left) * 4;
      data[dest] = image.data[source] ?? 0;
      data[dest + 1] = image.data[source + 1] ?? 0;
      data[dest + 2] = image.data[source + 2] ?? 0;
      data[dest + 3] = image.channels === 4 ? image.data[source + 3] ?? 0 : 255;
    }
    return encode({ width: size, height: size, channels: 4, data });
  } catch { return null; }
}

export async function fetchPublicBrand(url: string, anonKey: string): Promise<{ logo: string }> {
  if (!url || !anonKey) return { logo: "" };
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/public_shop_brand`, {
    method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: "{}", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Public branding setup is not available");
  const data = await response.json() as { logo?: unknown };
  return { logo: typeof data.logo === "string" && logoIcon(data.logo) ? data.logo : "" };
}