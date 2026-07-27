function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|limited|co|company|technologies|technology|tech|labs|group|holdings)\b\.?/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalized company for dedupe (also strips corporate descriptors). */
export function normCompany(s: string): string {
  return norm(s)
    .replace(/\b(bank|banking|securities|financial|capital|consulting|consultants|solutions|services|systems|global|canada|canadian|digital|online|enterprises?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalized title for dedupe (strips level fluff, keeps real distinctions). */
export function normTitle(s: string): string {
  return norm(s)
    .replace(/\b(new grad(uate)?|entry level|junior|jr|associate)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cross-source dedupe fingerprint: normalized company + title + city.
 * Fuzzy enough that "Wealthsimple Inc." == "Wealthsimple", and title
 * punctuation differences collapse.
 */
export function jobFingerprint(input: { company: string; title: string; city: string; locationRaw: string }): string {
  const place = input.city || input.locationRaw.split(/[,|/–-]/)[0] || "unknown";
  return [normCompany(input.company), normTitle(input.title), norm(place)].join("|");
}

/**
 * Second-chance company match for the same normalized title+city:
 * equal after normalization, one contains the other, or strong token overlap
 * (handles "TD" vs "TD Bank" vs "TD Securities").
 */
export function companiesMatch(a: string, b: string): boolean {
  const na = normCompany(a);
  const nb = normCompany(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter >= Math.min(ta.size, tb.size) && inter > 0;
}
