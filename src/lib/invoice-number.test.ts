import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextInvoiceNumber } from "./invoice-number";

describe("automatic invoice series", () => {
  it("starts with RT1001", () => assert.equal(nextInvoiceNumber([], "sale"), "RT1001"));
  it("advances RT1001 to RT1002 even when old bills have duplicate numbers", () => assert.equal(nextInvoiceNumber(["RT1001", "RT1001"], "sale"), "RT1002"));
  it("advances RT1002 to RT1003", () => assert.equal(nextInvoiceNumber(["RT1001", "RT1002"], "sale"), "RT1003"));
  it("uses highest numeric suffix rather than count or text order", () => assert.equal(nextInvoiceNumber(["RT9999", "RT10000", "RT1001"], "sale"), "RT10001"));
  it("keeps purchase numbers separate", () => assert.equal(nextInvoiceNumber(["RT27154", "PI1002"], "purchase"), "PI1003"));
});