import { it as test } from "node:test";
import assert from "node:assert/strict";
const expect = (v: unknown) => ({ toBe: (e: unknown) => assert.equal(v, e) });
import { displayRate, storedRate } from "./invoice-entry";
import { lineCalc } from "./books";
test("inclusive 118 at 18% gives taxable 100, GST 18, total 118", () => {
  const rate = storedRate(118, 18, true);
  const c = lineCalc({ quantity: 1, rate, discount: 0, gst_rate: 18 } as any);
  expect(Math.round(c.taxable * 100) / 100).toBe(100);
  expect(Math.round(c.amount * 100) / 100).toBe(118);
  expect(displayRate(rate, 18, true)).toBe(118);
});
test("inclusive 5% and 28% totals match typed price times quantity", () => {
  for (const g of [5, 12, 28]) expect(Math.round(lineCalc({ quantity: 3, rate: storedRate(250, g, true), discount: 0, gst_rate: g } as any).amount * 100) / 100).toBe(750);
});
test("exclusive rates are unchanged", () => { expect(storedRate(100, 18, false)).toBe(100); });

import { nextNumericBarcode } from "./invoice-entry";
test("new purchase barcode continues the numeric series", () => { expect(nextNumericBarcode(["1", "7961", "BD123", "", null, "12"])).toBe("7962"); });

import { purchaseCodeMatches } from "./invoice-entry";
test("purchase item code 4 shows code 4 first and excludes others", () => {
  const r = purchaseCodeMatches([{ sku: "6" }, { sku: "41" }, { sku: "4" }, { sku: "14" }], "4");
  assert.deepEqual(r.map(p => p.sku), ["4", "41"]);
});
