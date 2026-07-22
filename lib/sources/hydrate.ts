import { fetchText, stripHtml } from "./http";

/**
 * Some listings arrive without a description (Simplify rows, LinkedIn cards
 * beyond the detail-fetch cap). Hydrate on demand: LinkedIn via the guest
 * detail endpoint, anything else by fetching the posting page itself.
 * Returns "" when nothing usable is found.
 */
export async function hydrateJobDescription(input: {
  source: string;
  sourceId: string;
  applyUrl: string;
}): Promise<string> {
  // LinkedIn guest jobPosting detail endpoint (id is the posting urn number).
  if (input.source === "linkedin") {
    const id = input.sourceId.replace(/\D/g, "") || (input.applyUrl.match(/(\d{6,})/)?.[1] ?? "");
    if (id) {
      try {
        const html = await fetchText(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) job-hub/1.0" },
        }, 12000);
        const m = html.match(/<div class="description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const text = stripHtml(m?.[1] ?? "");
        if (text.length > 200) return text;
      } catch {
        // fall through to generic
      }
    }
  }

  // Generic: fetch the posting page and take its text.
  try {
    const html = await fetchText(input.applyUrl, {}, 12000);
    const text = stripHtml(html);
    return text.length > 400 ? text.slice(0, 12000) : "";
  } catch {
    return "";
  }
}
