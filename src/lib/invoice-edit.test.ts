import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateSalesInvoice, type Header, type Line } from "./books";

const header: Header = { bill_no: "RT27154", bill_date: "2026-08-25", party_name: "Customer", contact: "", payment_mode: "credit", tax_type: "gst", bill_type: "B2C", salesman: "", ref_no: "", bill_discount: 0, other_exp: 0, freight: 0, cash_disc: 0, remarks: "", shipping_address: "", billing_address: "" };
const line: Line = { product_id: "product-1", item_name: "Item", barcode: "", unit: "pcs", quantity: 2, free_qty: 0, rate: 100, discount: 0, gst_rate: 18, profit_pct: 0 };

describe("saved sales bill updates", () => {
  test("updates the existing bill through one atomic call without deleting it", async () => {
    const calls: unknown[] = [];
    const sb = { rpc: async (name: string, params: unknown) => { calls.push({ name, params }); return { data: "original-bill-id", error: null }; }, from: () => { throw new Error("Must not delete or re-create bill"); } } as unknown as SupabaseClient;
    assert.equal(await updateSalesInvoice(sb, "original-bill-id", header, [line]), "original-bill-id");
    assert.deepEqual(calls, [{ name: "update_sales_invoice", params: { _invoice_id: "original-bill-id", _header: header, _lines: [line] } }]);
  });
  test("missing setup stops the update instead of falling back to destructive writes", async () => {
    const sb = { rpc: async () => ({ data: null, error: { code: "PGRST202" } }), from: () => { throw new Error("Must not delete bill"); } } as unknown as SupabaseClient;
    await assert.rejects(updateSalesInvoice(sb, "original-bill-id", header, [line]), /original bill is unchanged/);
  });
});