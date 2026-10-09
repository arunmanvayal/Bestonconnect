import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { discountAmount, discountPercent } from "./invoice-entry";
describe("reference invoice discounts", () => {
  it("10 percent on gross 200 is discount 20", () => assert.equal(discountAmount(200, 10), 20));
  it("loads a saved amount 20 on gross 200 as 10 percent", () => assert.equal(discountPercent(200, 20), 10));
  it("does not allow a percentage beyond 100", () => assert.equal(discountAmount(200, 150), 200));
});