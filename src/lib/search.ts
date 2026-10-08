/** Match every query word across explicit searchable fields, without null placeholders. */
export function matchesSearch(query: string, ...fields: unknown[]): boolean {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const words = normalize(query).split(" ").filter(Boolean);
  const text = normalize(fields.filter(value => value != null).map(String).join(" "));
  return words.every(word => text.includes(word));
}