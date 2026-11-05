import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ExtractedItem = { name: string; quantity: number; rate: number; gst_rate: number | null; mrp: number | null; hsn: string | null };
export type ExtractedInvoice = { supplier: string | null; bill_no: string | null; bill_date: string | null; items: ExtractedItem[] };

const schema = z.object({
  supplier: z.string().nullable(),
  bill_no: z.string().nullable(),
  bill_date: z.string().nullable().describe("YYYY-MM-DD"),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    rate: z.number().describe("Unit price before tax as printed on the bill"),
    gst_rate: z.number().nullable(),
    mrp: z.number().nullable(),
    hsn: z.string().nullable(),
  })),
});

const MAX_BYTES = 8 * 1024 * 1024;

/** Reads a supplier bill photo/PDF with AI and returns line items for staff to review. Signed-in users only. */
export const extractSupplierInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; dataUrl: string; mimeType: string }) => {
    if (!input?.accessToken || !input.dataUrl?.startsWith("data:")) throw new Error("Invalid upload");
    if (!/^image\/|^application\/pdf$/.test(input.mimeType)) throw new Error("Upload an image or PDF");
    if (input.dataUrl.length * 0.75 > MAX_BYTES) throw new Error("File is larger than 8 MB");
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true; invoice: ExtractedInvoice } | { ok: false; error: string }> => {
    const url = process.env["EXTERNAL_SUPABASE_URL"], anon = process.env["EXTERNAL_SUPABASE_ANON_KEY"], key = process.env["LOVABLE_API_KEY"];
    if (!url || !anon || !key) return { ok: false, error: "Server is not configured" };
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${data.accessToken}` } });
    if (!who.ok) return { ok: false, error: "Please sign in again" };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const isPdf = data.mimeType === "application/pdf";
    try {
      const result = streamText({
        model: openai.responses("openai/gpt-6-astra"),
        maxRetries: 0,
        output: Output.object({ schema }),
        system: "You read Indian supplier purchase invoices (GST bills). Extract every product line exactly as printed. quantity = billed quantity, rate = unit rate before tax. Do not invent items; use null when a value is not shown.",
        messages: [{ role: "user", content: [
          { type: "text", text: "Extract the supplier name, bill number, bill date and all product lines from this invoice." },
          { type: "file", data: data.dataUrl, mediaType: isPdf ? "application/pdf" : data.mimeType },
        ] }],
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const invoice = await result.output as ExtractedInvoice;
      return { ok: true, invoice };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      console.error("extractSupplierInvoice", status, e?.message);
      if (status === 402) return { ok: false, error: "AI credits have run out. Add credits in Settings → Plans & credits." };
      if (status === 429) return { ok: false, error: "Too many requests right now. Please try again in a minute." };
      if (status === 403) return { ok: false, error: "AI access is blocked for this workspace." };
      return { ok: false, error: "Could not read this invoice. Try a clearer photo." };
    }
  });
