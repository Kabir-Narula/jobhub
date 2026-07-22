function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|limited|co|company|technologies|technology|tech|labs|group|holdings)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
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
  return [norm(input.company), norm(input.title), norm(place)].join("|");
}
