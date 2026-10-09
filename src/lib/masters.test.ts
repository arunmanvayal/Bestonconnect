import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PRODUCT, productForm, productInvoiceDefaults, productPayload, masterNames } from "./masters";
describe("shared product master details", () => {
  test("preserves purchase, sale, MRP and unit conversion fields", () => {
    const data = productPayload({ ...EMPTY_PRODUCT, name: "Bolt", cost_price: "50", unit_price: "75", mrp: "100", alt_unit: "box", conv_factor: "10" });
    assert.deepEqual([data['cost_price'], data['unit_price'], data['mrp'], data['alt_unit'], data['conv_factor']], [50,75,100,"box",10]);
  });
  test("fetches sales rate and split tax from the product", () => {
    assert.equal(productInvoiceDefaults({ unit_price: 118, sale_tax_incl: true, cgst_rate: 9, sgst_rate: 9 }, "sale", "gst").rate,100);
  });
  test("fetches purchase rate and IGST from the product", () => {
    const p=productInvoiceDefaults({cost_price:40,igst_rate:12},"purchase","igst"); assert.equal(p.rate,40);assert.equal(p.gst_rate,12);
  });
  test("deactivated products cannot fill new invoice entries", () => {
    assert.throws(() => productInvoiceDefaults({ deactivated:true }, "sale", "gst"));
  });
  test("reopened legacy products retain GST values", () => {
    assert.equal(productForm({gst_rate:12}).cgst_rate,"6");
  });
  test("zero conversion cannot be saved", () => {
    assert.throws(() => productPayload({...EMPTY_PRODUCT,name:"Bolt",conv_factor:"0"}));
  });
  test("inactive master options are excluded while an existing selection remains", () => {
    assert.deepEqual(masterNames([{id:"a",kind:"category",name:"Old",code:"",details:{},active:false}], "category", "Existing"),["Existing"]);
  });
});