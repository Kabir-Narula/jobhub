import { fetchJson, fetchText, stripHtml } from "./http";

/**
 * Some listings arrive without a description (Simplify rows, LinkedIn cards and
 * Workday jobs beyond each adapter's detail-fetch cap). Hydrate on demand:
 * LinkedIn via the guest detail endpoint, Workday via its CXS detail endpoint,
 * anything else by fetching the posting page itself.
 * Returns "" when nothing usable is found.
 */
export async function hydrateJobDescription(input: {
  source: string;
  sourceId: string;
  applyUrl: string;
}): Promise<string> {
  // Workday first: its /en-US/ page is a JS shell with no readable text, so the
  // generic branch below can NEVER recover a description — the job stays blank
  // forever and tailoring runs with no posting to target (silently producing a
  // lightly-reworded master). The CXS endpoint is the same one workdayAdapter
  // uses for the first MAX_DETAILS jobs; this is how the rest catch up.
  // Reconstructable from the stored row: sourceId is the externalPath verbatim,
  // and on every configured board the tenant is the host's first label.
  if (input.source.startsWith("workday:")) {
    const m = /^https:\/\/([^/]+)\/en-US\/([^/]+)(\/.*)$/.exec(input.applyUrl);
    if (m) {
      const [, host, site, urlPath] = m;
      const tenant = host.split(".")[0];
      const path = input.sourceId.startsWith("/") ? input.sourceId : urlPath;
      try {
        const d = await fetchJson<{ jobPostingInfo?: { jobDescription?: string } }>(
          `https://${host}/wday/cxs/${tenant}/${site}${path}`,
          {},
          12000
        );
        const text = stripHtml(d.jobPostingInfo?.jobDescription ?? "");
        if (text.length > 200) return text;
      } catch {
        // fall through to generic
      }
    }
  }

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
