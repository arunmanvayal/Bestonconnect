import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterShopProducts, SHOP_CATEGORIES, type ShopProduct } from "./online-shop";

const electrical = { id: "1", name: "LED Bulb", sku: "LED-9", category: "Electricals" } as ShopProduct;
const electronic = { id: "2", name: "USB Charger", sku: "USB-1", category: "Electronics" } as ShopProduct;
const hardware = { id: "3", name: "Steel Bolt", sku: "M8", category: "Hardware" } as ShopProduct;
describe("owner-selected electrical shop", () => {
  it("provides electricals, electronics and hardware categories", () => assert.deepEqual(SHOP_CATEGORIES, ["Electricals", "Electronics", "Hardware"]));
  it("shows only electricals when that category is selected", () => assert.deepEqual(filterShopProducts([electrical,electronic,hardware], "", "Electricals").map(p => p.id), ["1"]));
  it("finds real stock products by their item code", () => assert.deepEqual(filterShopProducts([electrical,electronic,hardware], "m8", "All").map(p => p.id), ["3"]));
  it("finds the category named in the home search", () => assert.deepEqual(filterShopProducts([electrical,electronic,hardware], "electronics", "All").map(p => p.id), ["2"]));
  it("finds words in reverse order without leaving the selected category", () => assert.deepEqual(filterShopProducts([electrical,electronic,hardware], "bolt steel", "Hardware").map(p => p.id), ["3"]));
  it("combines category selection and search", () => assert.deepEqual(filterShopProducts([electrical,electronic,hardware], "usb", "Hardware"), []));
});