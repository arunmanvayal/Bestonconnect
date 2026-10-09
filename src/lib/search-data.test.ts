import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSearchRecords } from "./search-data";
import { matchesSearch } from "./search";

describe("complete search datasets", () => {
  it("finds records beyond 1000 rows and keeps company filtering on every page", async () => {
    const records = Array.from({ length: 1201 }, (_, id) => ({ id, name: id === 1200 ? "Old Steel Bolt" : "LED Bulb" }));
    const ranges: number[] = [];
    let scopes = 0;
    const sb = { from: () => {
      const query = { select: () => query, order: () => query, eq: (column: string, value: string) => { assert.equal(column, "company_id"); assert.equal(value, "company-a"); scopes++; return query; }, range: (from: number, to: number) => { ranges.push(from); return Object.assign(query, { then: (resolve: (result: unknown) => void) => resolve({ data: records.slice(from, to + 1), error: null }) }); } };
      return query;
    } } as unknown as SupabaseClient;
    const result = await fetchSearchRecords(sb, "products", "name", q => q.eq("company_id", "company-a"));
    assert.deepEqual(ranges, [0, 500, 1000]);
    assert.equal(scopes, 3);
    assert.deepEqual(result.filter(p => matchesSearch("steel", p.name)).map(p => p.id), [1200]);
  });
  it("does not silently return partial data when fetching fails", async () => {
    const sb = { from: () => { const query = { select: () => query, order: () => query, range: async () => ({ data: null, error: new Error("Read failed") }) }; return query; } } as unknown as SupabaseClient;
    await assert.rejects(fetchSearchRecords(sb, "products", "name"), /Read failed/);
  });
});