/** Match every query word across explicit searchable fields, without null placeholders. */
export function matchesSearch(query: string, ...fields: unknown[]): boolean {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const words = normalize(query).split(" ").filter(Boolean);
  const text = normalize(fields.filter(value => value != null).map(String).join(" "));
  return words.every(word => text.includes(word));
}
/** Relevance score (lower = better): exact, prefix, word-start matches, then embedded substrings last. */
export function searchRank(query: string, primary: unknown, ...others: unknown[]): number {
  const n = (v: unknown) => String(v ?? "").normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const q = n(query); if (!q) return 0;
  const name = n(primary); const all = [name, ...others.map(n)];
  if (all.includes(q)) return 0;
  if (name.startsWith(q)) return 1;
  const words = q.split(" ");
  const tokens = all.join(" ").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const embedded = words.filter(w => !tokens.some(t => t.startsWith(w))).length;
  return embedded === 0 ? 2 : 3 + embedded;
}

/** Filter with matchesSearch, then sort by relevance, shorter name, then alphabetically. */
export function rankedSearch<T>(items: T[], query: string, fields: (item: T) => unknown[], limit = 50): T[] {
  const hits = items.map(item => { const f = fields(item); return { item, f }; }).filter(x => matchesSearch(query, ...x.f));
  return hits.map(x => ({ ...x, r: searchRank(query, x.f[0], ...x.f.slice(1)), name: String(x.f[0] ?? "") }))
    .sort((a, b) => a.r - b.r || a.name.length - b.name.length || a.name.localeCompare(b.name, undefined, { numeric: true }))
    .slice(0, limit).map(x => x.item);
}
