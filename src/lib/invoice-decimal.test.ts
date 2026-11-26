import { it } from "node:test";
import assert from "node:assert/strict";
import { parseEntryDecimal, storedRate, displayRate, salePriceFromProfit } from "./invoice-entry";
import { lineCalc } from "./books";

it("accepts 15.00321035 including each intermediate decimal zero", () => {
  const text = "15.00321035";
  for (let length = 1; length <= text.length; length++) {
    const prefix = text.slice(0, length);
    assert.equal(parseEntryDecimal(prefix), Number(prefix));
  }
  assert.equal(parseEntryDecimal(text), 15.00321035);
});
it("retains the requested five- and two-decimal prices", () => {
  for (const text of ["15.05315", "15.035", "15.53"]) assert.equal(parseEntryDecimal(text), Number(text));
});
it("uses the full 15.00321035 exclusive rate in quantity and tax calculations", () => {
  const c = lineCalc({ quantity: 1000, rate: 15.00321035, discount: 0, gst_rate: 18 } as Parameters<typeof lineCalc>[0]);
  assert.ok(Math.abs(c.gross - 15003.21035) < 1e-9);
  assert.ok(Math.abs(c.tax - 2700.577863) < 1e-9);
});
it("preserves the full 15.00321035 inclusive price during tax conversion", () => {
  const rate = storedRate(15.00321035, 18, true);
  assert.ok(Math.abs(displayRate(rate, 18, true) - 15.00321035) < 1e-12);
  const c = lineCalc({ quantity: 1000, rate, discount: 0, gst_rate: 18 } as Parameters<typeof lineCalc>[0]);
  assert.ok(Math.abs(c.amount - 15003.21035) < 1e-9);
});
it("does not round the derived purchase sale price to two decimals", () => {
  assert.equal(salePriceFromProfit(15.00321035, 0), 15.00321035);
  assert.ok(Math.abs(salePriceFromProfit(15.00321035, 10) - 16.503531385) < 1e-12);
});
it("allows clearing and rejects invalid or negative price text", () => {
  assert.equal(parseEntryDecimal(""), 0);
  assert.equal(parseEntryDecimal("."), 0);
  for (const text of ["15..3", "-1", "NaN", "1e3"]) assert.equal(parseEntryDecimal(text), null);
});