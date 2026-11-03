import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchesSearch } from "./search";

describe("shared search", () => {
  it("ignores case and excess whitespace", () => assert.equal(matchesSearch("  LED   BULB ", "Led bulb"), true));
  it("matches words across fields in any order", () => assert.equal(matchesSearch("m8 steel", "Steel Bolt", "M8"), true));
  it("requires every search word", () => assert.equal(matchesSearch("steel charger", "Steel Bolt", "M8"), false));
  it("does not turn missing fields into searchable text", () => assert.equal(matchesSearch("undefined", undefined, null), false));
  it("returns all records for a blank search", () => assert.equal(matchesSearch("   ", "Steel Bolt"), true));
  it("treats punctuation as literal text", () => assert.equal(matchesSearch("%_", "M8"), false));
});
import { rankedSearch } from "./search";
describe("invoice search ranking", () => {
  it("pvc past shows PVC PASTE before CPVC PASTE", () => {
    const items = [{ name: "CPVC PASTE 118 ML" }, { name: "CPVC PASTE 15ML TUBE" }, { name: "PVC PASTE 100ML" }, { name: "HEAVY PVC PASTE" }];
    assert.deepEqual(rankedSearch(items, "pvc past", p => [p.name]).map(p => p.name), ["PVC PASTE 100ML", "HEAVY PVC PASTE", "CPVC PASTE 118 ML", "CPVC PASTE 15ML TUBE"]);
  });
});
