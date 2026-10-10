import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PARTY, invoicePartyType, partyPayload } from "./invoice-party";

describe("invoice F11 party creation", () => {
  it("purchase creates a reusable supplier record", () => {
    const payload = partyPayload("purchase", { ...EMPTY_PARTY, name: "New Supplier", phone: "123", address: "Main Road" }, "company-a");
    assert.equal(payload.party_type, "supplier");
    assert.equal(payload.name, "New Supplier");
    assert.equal(payload.company_id, "company-a");
    assert.equal(payload.contact_no, "123");
    assert.equal(payload.address, "Main Road");
  });
  it("sales creates a reusable customer record", () => {
    assert.equal(partyPayload("sale", { ...EMPTY_PARTY, name: "New Customer" }, "company-a").party_type, "customer");
    assert.equal(invoicePartyType("sale"), "customer");
  });
  it("does not allow blank names", () => {
    assert.throws(() => partyPayload("sale", { ...EMPTY_PARTY, name: "  " }, "company-a"), /Name is required/);
  });
  it("does not save without an active company", () => {
    assert.throws(() => partyPayload("purchase", { ...EMPTY_PARTY, name: "Supplier" }, ""), /Select a company/);
  });
});