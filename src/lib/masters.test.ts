import { describe, expect, test } from "bun:test";
import { EMPTY_PRODUCT, productForm, productInvoiceDefaults, productPayload, masterNames } from "./masters";
describe("shared product master details", () => {
  test("preserves purchase, sale, MRP and unit conversion fields", () => {
    const data = productPayload({ ...EMPTY_PRODUCT, name: "Bolt", cost_price: "50", unit_price: "75", mrp: "100", alt_unit: "box", conv_factor: "10" });
    expect([data.cost_price, data.unit_price, data.mrp, data.alt_unit, data.conv_factor]).toEqual([50,75,100,"box",10]);
  });
  test("fetches sales rate and split tax from the product", () => {
    expect(productInvoiceDefaults({ unit_price: 118, sale_tax_incl: true, cgst_rate: 9, sgst_rate: 9 }, "sale", "gst").rate).toBe(100);
  });
  test("fetches purchase rate and IGST from the product", () => {
    expect(productInvoiceDefaults({cost_price: 40, igst_rate: 12}, "purchase", "igst")).toMatchObject({rate:40,gst_rate:12});
  });
  test("deactivated products cannot fill new invoice entries", () => {
    expect(() => productInvoiceDefaults({ deactivated:true }, "sale", "gst")).toThrow();
  });
  test("reopened legacy products retain GST values", () => {
    expect(productForm({gst_rate: 12}).cgst_rate).toBe("6");
  });
  test("zero conversion cannot be saved", () => {
    expect(() => productPayload({...EMPTY_PRODUCT, name:"Bolt",conv_factor:"0"})).toThrow();
  });
  test("inactive master options are excluded while an existing selection remains", () => {
    expect(masterNames([{id:"a",kind:"category",name:"Old",code:"",details:{},active:false}], "category", "Existing")).toEqual(["Existing"]);
  });
});