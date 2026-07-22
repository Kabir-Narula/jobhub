import type { LocationBucket, WorkMode } from "@prisma/client";

// Old City of Toronto + boroughs = "Toronto-based".
const TORONTO_CITIES = new Set([
  "toronto",
  "north york",
  "scarborough",
  "etobicoke",
  "york",
  "east york",
  "downtown toronto",
]);

// GTA commuting radius (configurable extension via GTA_EXTRA_CITIES, comma-separated).
const GTA_CITIES = new Set([
  "mississauga",
  "brampton",
  "markham",
  "vaughan",
  "richmond hill",
  "oakville",
  "ajax",
  "pickering",
  "whitby",
  "oshawa",
  "newmarket",
  "aurora",
  "milton",
  "burlington",
  "halton hills",
  "caledon",
  "vaughan",
  "king city",
  "stouffville",
  "whitchurch-stouffville",
  "georgina",
  "uxbridge",
  "clarington",
  "bradford",
  "thornhill",
  "woodbridge",
  "concord",
  "maple",
  "bolton",
  "hamilton",
]);

for (const extra of (process.env.GTA_EXTRA_CITIES ?? "").split(",")) {
  const c = extra.trim().toLowerCase();
  if (c) GTA_CITIES.add(c);
}

export interface ParsedLocation {
  city: string;
  workMode: WorkMode;
  bucket: LocationBucket | null; // null = exclude from the hub
}

function normalizeCity(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(on|ontario|canada|ca|on canada)\b\.?/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Try to extract a known city from a raw location string like "Toronto, ON" or "Remote - Canada". */
export function extractCity(locationRaw: string): string {
  const raw = locationRaw.toLowerCase();
  // Segment-based exact matching: "New York, NY" -> ["new york", "ny"], neither
  // is a Toronto city. ("york" alone IS one — but only as a full segment.)
  const segments = raw
    .split(/[,|/;•·]|\s+[-–—]\s+|\(|\)/)
    .map((s) => normalizeCity(s))
    .filter(Boolean);
  for (const seg of segments) {
    if (TORONTO_CITIES.has(seg)) return seg;
  }
  for (const seg of segments) {
    if (GTA_CITIES.has(seg)) return seg;
  }
  // Phrase fallback: "Greater Toronto Area", "Downtown Toronto", "Toronto/GTA hybrid"
  if (/\btoronto\b/.test(raw)) return "toronto";
  for (const city of GTA_CITIES) {
    if (new RegExp(`\\b${city.replace(/\s/g, "\\s")}\\b`).test(raw)) return city;
  }
  return segments[0] ?? normalizeCity(locationRaw);
}

export function detectWorkMode(locationRaw: string, remoteFlag: boolean | null, text = ""): WorkMode {
  const hay = `${locationRaw}\n${text.slice(0, 2000)}`;
  if (/\bhybrid\b/i.test(hay)) return "HYBRID";
  if (/\bremote\b|work from (home|anywhere)|wfh\b|distributed/i.test(hay)) return "REMOTE";
  if (remoteFlag === true) return "REMOTE";
  if (remoteFlag === false) return "ONSITE";
  if (/\bon[- ]?site\b|in[- ]office\b/i.test(hay)) return "ONSITE";
  return "UNKNOWN";
}

/**
 * Location policy (explicit, per spec):
 *  - Toronto  -> include regardless of work mode
 *  - GTA      -> include (commutable)
 *  - anything else -> include ONLY if remote
 */
export function bucketFor(city: string, workMode: WorkMode, locationRaw: string): LocationBucket | null {
  if (TORONTO_CITIES.has(city)) return "TORONTO";
  if (GTA_CITIES.has(city)) return "GTA_COMMUTE";

  // Remote jobs: include when the role is open to Canada / anywhere, exclude explicit non-Canada remotes.
  if (workMode === "REMOTE") {
    if (/\b(usa only|us only|united states only|us-based|must reside in (the )?(us|united states))\b/i.test(locationRaw)) {
      return null;
    }
    // "Remote in USA", "Remote, United States" etc. — unless Canada or worldwide is also mentioned.
    if (/\b(usa|u\.s\.a?|united states)\b/i.test(locationRaw) && !/canada/i.test(locationRaw)) {
      if (!/worldwide|anywhere|global/i.test(locationRaw)) return null;
    }
    return "REMOTE";
  }
  return null;
}

export function parseLocation(locationRaw: string, remoteFlag: boolean | null, text = ""): ParsedLocation {
  const city = extractCity(locationRaw);
  const workMode = detectWorkMode(locationRaw, remoteFlag, text);
  const bucket = bucketFor(city, workMode, locationRaw);
  return { city, workMode, bucket };
}
