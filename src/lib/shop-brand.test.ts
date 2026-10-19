import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { decode, encode } from "fast-png";
import { logoIcon } from "./shop-brand";
import { SHOP_BRAND_SQL } from "./shop-brand-sql";

describe("dashboard logo shared with public shop and favicon", () => {
  it("uses the uploaded logo without stretching a wide mark", () => {
    const source = encode({ width: 4, height: 2, channels: 4, data: new Uint8Array(32).fill(255) });
    const icon = logoIcon(`data:image/png;base64,${Buffer.from(source).toString("base64")}`);
    assert.ok(icon);
    const result = decode(icon);
    assert.equal(result.width, 96);
    assert.equal(result.height, 96);
    assert.equal(result.data[3], 0);
    assert.equal(result.data[(48 * 96 + 48) * 4 + 3], 255);
  });
  it("rejects remote sources and executable SVG logos", () => {
    assert.equal(logoIcon("https://example.com/logo.png"), null);
    assert.equal(logoIcon("data:image/svg+xml,<svg/>"), null);
  });
  it("exposes only the primary logo to guests while profiles stay private", async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon; create role authenticated;
        create table public.companies(id integer, created_at timestamptz, logo text, account_no text);
        insert into companies values (1,'2020-01-01','first-logo','private-bank'), (2,'2021-01-01','second-logo','other-bank');
        alter table companies enable row level security;`);
      await db.exec(SHOP_BRAND_SQL);
      await db.exec("set role anon");
      const { rows } = await db.query<{ brand: unknown }>("select public.public_shop_brand() as brand");
      assert.deepEqual(rows[0]?.brand, { logo: "first-logo" });
      await assert.rejects(db.query("select account_no from companies"), /permission denied/);
    } finally { await db.close(); }
  });
});
describe("logo fix", () => {
  it("skips an older company without a logo", async () => {
    const { SHOP_BRAND_LOGO_FIX_SQL } = await import("./shop-brand-sql");
    const db = new PGlite();
    try {
      await db.exec(`create role anon; create role authenticated;
        create table public.companies(id integer, created_at timestamptz, logo text);
        insert into companies values (1,'2020-01-01',''), (2,'2021-01-01','bc-logo');`);
      await db.exec(SHOP_BRAND_LOGO_FIX_SQL);
      await db.exec("set role anon");
      const { rows } = await db.query<{ brand: unknown }>("select public.public_shop_brand() as brand");
      assert.deepEqual(rows[0]?.brand, { logo: "bc-logo" });
    } finally { await db.close(); }
  });
});
