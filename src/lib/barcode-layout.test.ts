import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LAYOUT, fitLabels } from "./barcode-layout";

test("default layout fills A4 with 4 × 10 = 40 labels", () => {
  assert.deepEqual(fitLabels(DEFAULT_LAYOUT), { cols: 4, rows: 10, perSheet: 40 });
});

test("larger labels reduce how many fit", () => {
  assert.deepEqual(fitLabels({ ...DEFAULT_LAYOUT, width: 63.5, height: 38.1, gapX: 2.5, marginLeft: 7, marginTop: 15 }), { cols: 3, rows: 7, perSheet: 21 });
});
