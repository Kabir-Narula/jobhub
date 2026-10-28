import { stripHtml } from "@/lib/sources/http";

/**
 * Phenom career sites (Air Canada and others) render the posting from
 * `phApp.ddo` in a script tag. The HTML left for a non-JS fetch is only the
 * "posting is no longer active / join our talent network" widget, which is
 * long enough to look like a description and then never gets replaced.
 */

export interface EmbeddedPosting {
  title: string;
  company: string;
  locationRaw: string;
  description: string;
}

const CLOSED_SHELL =
  /no longer active|posting (is |has been )?(closed|expired)|this (job|position|role) (is|has been) (no longer|closed|filled)/i;

/** Short widget text, not a posting that happens to mention a closing date. */
export function isClosedShell(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 40 || t.length >= 1800) return false;
  return CLOSED_SHELL.test(t);
}

/** Empty, stub, or closed-widget text should be fetched again from the posting URL. */
export function needsDescriptionFetch(text: string): boolean {
  const t = text.trim();
  return t.length < 400 || isClosedShell(t);
}

function extractAssignedJson(html: string, assign: RegExp): unknown | null {
  const at = html.search(assign);
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function findPhenomJob(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || typeof node !== "object" || depth > 16) return null;
  if (!Array.isArray(node)) {
    const o = node as Record<string, unknown>;
    const raw = str(o.externalDescription) || str(o.description);
    const titled = str(o.title) || str(o.ml_title);
    if (titled && raw.length > 400) return o;
  }
  const values = Array.isArray(node) ? node : Object.values(node as object);
  for (const v of values) {
    const found = findPhenomJob(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function plainDescription(raw: string): string {
  const text = /<[a-z]/i.test(raw) ? stripHtml(raw) : raw;
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function bestDescription(o: Record<string, unknown>): string {
  const candidates = [str(o.externalDescription), str(o.description)]
    .map(plainDescription)
    .filter((d) => d.length > 400 && !isClosedShell(d));
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? "";
}

function locationOf(o: Record<string, unknown>): string {
  const direct = str(o.location) || str(o.locationName);
  if (direct && !/^[A-Z]{3}$/.test(direct)) return direct;
  return [str(o.city), str(o.state), str(o.country)].filter(Boolean).join(", ");
}

/** Job body embedded by Phenom (`phApp.ddo`). Null when this page is not one. */
export function phenomFromHtml(html: string): EmbeddedPosting | null {
  if (!html.includes("phApp.ddo") && !html.includes("externalDescription")) return null;
  const data = extractAssignedJson(html, /phApp\.ddo\s*=/);
  if (!data) return null;
  const job = findPhenomJob(data);
  if (!job) return null;
  const description = bestDescription(job);
  if (!description) return null;
  return {
    title: str(job.title) || str(job.ml_title),
    company: str(job.companyName) || str(job.company),
    locationRaw: locationOf(job),
    description: description.slice(0, 12000),
  };
}
