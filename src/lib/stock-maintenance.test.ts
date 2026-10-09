import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { duplicateStockIds, barcodeSeries, filterStock } from "./stock-maintenance";
const stock = [
  { id: "a", name: "Bolt", sku: "M8", barcode: "10", quantity: 0 },
  { id: "b", name: "Bolt", sku: " m8 ", barcode: "20", quantity: 3 },
  { id: "c", name: "Wire", sku: "W1", barcode: "20", quantity: -1 },
  { id: "d", name: "Bolt", sku: "", barcode: "", quantity: 0 },
];
describe("stock cleanup rules", () => {
  it("flags identical item codes or barcodes, not identical names or blank codes", () => assert.deepEqual([...duplicateStockIds(stock)].sort(), ["a", "b", "c"]));
  it("zero stock means exactly zero, not negative stock", () => assert.deepEqual(filterStock(stock, "zero").map(p => p.id), ["a", "d"]));
  it("assigns every stock product a barcode starting at 1", () => assert.deepEqual(barcodeSeries(stock).map(p => p.barcode), ["1", "2", "3", "4"]));
  it("keeps the barcode preview stable when input ordering changes", () => assert.deepEqual(barcodeSeries([...stock].reverse()), barcodeSeries(stock)));
});