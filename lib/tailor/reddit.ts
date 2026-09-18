import { fetchJson } from "@/lib/sources/http";
import type { RoleFamily } from "./role-family";

/**
 * Community intel via PullPush (free Pushshift-style Reddit mirror).
 * Deep inspect: walk several subs, pull comment trees (not just post titles),
 * and search comments directly so resume advice buried in threads is visible.
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

async function searchPosts(query: string, size = 8, subreddit?: string): Promise<PpSubmission[]> {
  try {
    const sub = subreddit ? `&subreddit=${encodeURIComponent(subreddit)}` : "";
    const data = await fetchJson<{ data?: PpSubmission[] }>(
      `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(query)}&size=${size}&sort_type=score&sort=desc${sub}`,
      {},
      12000
    );
    return data.data ?? [];
  } catch {
    return [];
  }
}

async function searchComments(query: string, size = 12, subreddit?: string): Promise<string[]> {
  try {
    const sub = subreddit ? `&subreddit=${encodeURIComponent(subreddit)}` : "";
    const data = await fetchJson<{ data?: PpComment[] }>(
      `https://api.pullpush.io/reddit/search/comment/?q=${encodeURIComponent(query)}&size=${size}&sort_type=score&sort=desc${sub}`,
      {},
      12000
    );
    return (data.data ?? [])
      .map((c) => (c.body ?? "").replace(/\s+/g, " ").trim())
      .filter((b) => b.length > 80 && b !== "[deleted]" && b !== "[removed]")
      .slice(0, size)
      .map((b) => b.slice(0, 420));
  } catch {
    return [];
  }
}

async function threadComments(postId: string, size = 8): Promise<string[]> {
  try {
    const data = await fetchJson<{ data?: PpComment[] }>(
      `https://api.pullpush.io/reddit/search/comment/?link_id=${encodeURIComponent(postId)}&size=${size}&sort_type=score&sort=desc`,
      {},
      12000
    );
    return (data.data ?? [])
      .map((c) => (c.body ?? "").replace(/\s+/g, " ").trim())
      .filter((b) => b.length > 60 && b !== "[deleted]" && b !== "[removed]")
      .slice(0, size)
      .map((b) => b.slice(0, 360));
  } catch {
    return [];
  }
}

const CAREER_SUBS = ["cscareerquestions", "cscareerquestionsCAD", "EngineeringResumes", "interviews", "jobs", "ExperiencedDevs"];

const FAMILY_REDDIT: Record<RoleFamily, { subs: string[]; resumeQueries: string[] }> = {
  consulting: {
    subs: ["McKinsey_BCG_Bain", "consulting", "MBA", "FinancialCareers"],
    resumeQueries: [
      "resume Excel stakeholder",
      "resume bullets impact CAR",
      "business analyst resume PowerPoint",
      "skills consulting resume",
    ],
  },
  analyst: {
    subs: ["analytics", "datascience", "BusinessIntelligence", "consulting", "excel"],
    resumeQueries: [
      "data analyst resume Excel SQL",
      "business analyst resume bullets",
      "insights resume skills",
      "analyst resume stakeholder",
    ],
  },
  swe: {
    subs: CAREER_SUBS,
    resumeQueries: ["resume bullets intern", "new grad resume skills"],
  },
  "data-ml": {
    subs: ["datascience", "MachineLearning", "cscareerquestions", "learnmachinelearning"],
    resumeQueries: ["data scientist resume bullets", "ml engineer resume projects"],
  },
  infra: {
    subs: ["devops", "sysadmin", "cscareerquestions", "ITCareerQuestions"],
    resumeQueries: ["it support resume bullets", "help desk resume"],
  },
  product: {
    subs: ["ProductManagement", "product_management", "cscareerquestions"],
    resumeQueries: ["product manager resume intern", "APM resume bullets"],
  },
};

function digestPosts(posts: PpSubmission[], commentsById: Map<string, string[]>): string {
  const chunks: string[] = [];
  for (const p of posts) {
    let chunk = `THREAD (${p.score}pts): ${p.title}`;
    const self = (p.selftext ?? "").replace(/\s+/g, " ").trim().slice(0, 420);
    if (self) chunk += `\n${self}`;
    const comments = commentsById.get(p.id) ?? [];
    if (comments.length) chunk += `\nReplies (deep): ${comments.join(" // ")}`;
    chunks.push(chunk);
  }
  return chunks.join("\n\n");
}

/**
 * Company threads: several subs, then comment trees — not title-only skims.
 */
export async function fetchRedditIntel(company: string, opts?: { family?: RoleFamily }): Promise<string> {
  const family: RoleFamily = opts?.family ?? "swe";
  const mention = new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const relevant = (p: PpSubmission) => mention.test(`${p.title} ${p.selftext ?? ""}`);

  const seen = new Set<string>();
  const posts: PpSubmission[] = [];
  const collect = (batch: PpSubmission[]) => {
    for (const p of batch) {
      if (seen.has(p.id) || !p.title || !relevant(p)) continue;
      seen.add(p.id);
      posts.push(p);
    }
  };

  const spec = FAMILY_REDDIT[family];
  const subs = [...spec.subs, ...CAREER_SUBS.filter((s) => !spec.subs.includes(s))];
  const subBatches = await Promise.all(subs.slice(0, 5).map((sub) => searchPosts(company, 5, sub)));
  for (const batch of subBatches) collect(batch);
  if (posts.length < 4) {
    collect(await searchPosts(`"${company}" (interview OR resume OR offer OR recruiter)`));
  }
  const picked = posts.slice(0, 6);
  if (picked.length === 0) {
    const loose = await searchComments(`"${company}" (interview OR resume OR hiring)`, 10);
    return loose.length ? `COMMENT HITS:\n- ${loose.join("\n- ")}`.slice(0, 4000) : "";
  }

  const commentLists = await Promise.all(picked.map((p) => threadComments(p.id, 8)));
  const commentsById = new Map(picked.map((p, i) => [p.id, commentLists[i] ?? []]));
  const extraComments = await searchComments(`"${company}" (resume OR interview OR "what they look for")`, 8, spec.subs[0]);
  let out = digestPosts(picked, commentsById);
  if (extraComments.length) out += `\n\nDEEP COMMENT SEARCH:\n- ${extraComments.join("\n- ")}`;
  return out.slice(0, 4000);
}

/** Resume-advice threads + buried comments for this role family. */
export async function fetchRoleResumeIntel(family: RoleFamily): Promise<string> {
  const spec = FAMILY_REDDIT[family];
  const seen = new Set<string>();
  const posts: PpSubmission[] = [];

  const postBatches = await Promise.all(
    spec.resumeQueries.slice(0, 4).map((q, i) => searchPosts(q, 5, spec.subs[i % spec.subs.length]))
  );
  for (const batch of postBatches) {
    for (const p of batch) {
      if (seen.has(p.id) || !p.title) continue;
      seen.add(p.id);
      posts.push(p);
    }
  }
  const picked = posts.slice(0, 6);
  const commentLists = await Promise.all(picked.map((p) => threadComments(p.id, 8)));
  const commentsById = new Map(picked.map((p, i) => [p.id, commentLists[i] ?? []]));
  const buried = await Promise.all(
    spec.resumeQueries.slice(0, 3).map((q, i) => searchComments(q, 8, spec.subs[i % spec.subs.length]))
  );
  let out = digestPosts(picked, commentsById);
  const flat = buried.flat().slice(0, 12);
  if (flat.length) out += `\n\nBURIED COMMENTS (not just top posts):\n- ${flat.join("\n- ")}`;
  return out.slice(0, 4000);
}
