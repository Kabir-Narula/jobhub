import { fetchJson } from "@/lib/sources/http";

/**
 * Community intel via PullPush (free Pushshift-style Reddit mirror — the
 * official anonymous .json endpoints are dead, this is the no-auth path).
 * Digests what real candidates say about a company: interviews, offers,
 * process, what resonated.
 */

interface PpSubmission {
  id: string;
  title: string;
  selftext?: string;
  score: number;
  permalink: string;
}
interface PpComment {
  body?: string;
  score: number;
}

async function searchPosts(query: string, size = 6, subreddit?: string): Promise<PpSubmission[]> {
  try {
    const sub = subreddit ? `&subreddit=${encodeURIComponent(subreddit)}` : "";
    const data = await fetchJson<{ data?: PpSubmission[] }>(
      `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(query)}&size=${size}&sort_type=score&sort=desc${sub}`
    );
    return data.data ?? [];
  } catch {
    return [];
  }
}

async function topComments(postId: string, size = 2): Promise<string[]> {
  try {
    const data = await fetchJson<{ data?: PpComment[] }>(
      `https://api.pullpush.io/reddit/search/comment/?link_id=${encodeURIComponent(postId)}&size=${size}&sort_type=score&sort=desc`
    );
    return (data.data ?? [])
      .map((c) => (c.body ?? "").slice(0, 400))
      .filter((b) => b.length > 60 && b !== "[deleted]" && b !== "[removed]");
  } catch {
    return [];
  }
}

const CAREER_SUBS = ["cscareerquestions", "cscareerquestionsCAD", "interviews", "jobs", "recruitinghell", "torontoJobs", "ExperiencedDevs"];

/**
 * Returns a condensed digest for LLM grounding (~2000 chars), or "" when
 * the company has no meaningful Reddit footprint.
 */
export async function fetchRedditIntel(company: string): Promise<string> {
  const mention = new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const relevant = (p: PpSubmission) => mention.test(`${p.title} ${p.selftext ?? ""}`);

  const seen = new Set<string>();
  const posts: PpSubmission[] = [];
  const collect = (batch: PpSubmission[]) => {
    for (const p of batch) {
      if (seen.has(p.id) || !p.title || !relevant(p)) continue;
      seen.add(p.id);
      posts.push(p);
      if (posts.length >= 8) return true;
    }
    return false;
  };

  // Career subs first (most relevant), then sitewide as fallback.
  for (const sub of CAREER_SUBS) {
    if (collect(await searchPosts(company, 4, sub))) break;
  }
  if (posts.length < 3) {
    collect(await searchPosts(`"${company}" interview`));
    if (posts.length < 3) collect(await searchPosts(`"${company}" (hired OR offer OR recruiter OR "new grad")`));
  }
  if (posts.length === 0) return "";

  const chunks: string[] = [];
  for (const p of posts.slice(0, 4)) {
    let chunk = `THREAD (${p.score}pts): ${p.title}`;
    const self = (p.selftext ?? "").slice(0, 500);
    if (self) chunk += `\n${self}`;
    const comments = await topComments(p.id);
    if (comments.length) chunk += `\nTop replies: ${comments.join(" // ")}`;
    chunks.push(chunk);
  }
  return chunks.join("\n\n").slice(0, 2200);
}
