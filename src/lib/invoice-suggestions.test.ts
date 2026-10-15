import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestionPosition } from "./invoice-suggestions";

describe("purchase suggestion positioning", () => {
  it("keeps a bottom-row product list inside the 694×537 viewport", () => {
    const p = suggestionPosition({ left: 500, top: 450, bottom: 474, width: 160 }, { width: 694, height: 537 });
    assert.equal(p.top, 158);
    assert.equal(p.left, 366);
    assert.equal(p.width, 320);
    assert.equal(p.maxHeight, 288);
    assert.ok(p.top + p.maxHeight < 537);
  });
  it("fits narrow screens without horizontal overflow", () => {
    const p = suggestionPosition({ left: 200, top: 100, bottom: 124, width: 150 }, { width: 320, height: 537 });
    assert.equal(p.width, 304);
    assert.equal(p.left, 8);
    assert.equal(p.top, 128);
  });
});