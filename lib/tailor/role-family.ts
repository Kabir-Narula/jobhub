/**
 * Role family decides doctrine: bullets, skills, which jobs stay on the page,
 * and which Reddit threads to read. Without this, every posting defaults to
 * SWE (FastAPI, CI, Kotlin) — including McKinsey BA and Lilly Insights.
 *
 * Title+company win. A stray "analytics" in an Insights JD must not flip the
 * resume into data-engineering.
 */

export type RoleFamily = "consulting" | "analyst" | "swe" | "data-ml" | "infra" | "product";

export function isBusinessFamily(family: RoleFamily): boolean {
  return family === "consulting" || family === "analyst";
}

const SWE_TITLE =
  /\b(software|full[- ]?stack|front[- ]?end|back[- ]?end|sde|swe|site reliability|mlops|android|ios|mobile|firmware|embedded)\b.{0,30}\b(engineer|developer|programmer)\b|\b(software (engineer|developer)|swe|sde|full[- ]?stack developer)\b/i;

const DATA_ML_TITLE =
  /\b(data engineer|analytics engineer|machine learning engineer|ml engineer|mlops|applied scientist|ai engineer|research scientist)\b/i;

const CONSULTING_FIRM =
  /\b(mckinsey|boston consulting|\bbcg\b|bain\b|deloitte|pwc|pricewaterhouse|\bey\b|ernst\s*[&+]\s*young|kpmg|oliver wyman|strategy&|kearney|roland berger|\blek\b|accenture|alvarez\s*[&+]\s*marsal|parthenon|\bibm\b|\bzs\b|zs associates)\b/i;

const CONSULTING_TITLE =
  /\b((business|strategy|management|enterprise strategy)[- ]?(analyst|associate|consultant)|associate consultant|junior associate|case team|generalist|hr technology|techno[- ]?functional|strategy insights|insights?\s*&\s*planning)\b/i;

const ANALYST_TITLE =
  /\b((business|data|insights?|research|operations|market|marketing|financial|risk|pricing|reporting|bi|business intelligence|competitive intelligence|decision analytics)[- ]?(analyst|associate)|(?:market|competitive)\s+(?:and\s+)?(?:competitive\s+)?intelligence\s+analyst|insights? (associate|manager)|research associate|decision analytics associate|strategy insights)\b/i;

const PRODUCT_TITLE = /\b(product (manager|owner|analyst|associate)|program manager|tpm\b)\b/i;

const INFRA_TITLE =
  /\b(devops|sre|site reliability|platform engineer|it (support|analyst|consultant)|help ?desk|systems? admin|technical support|desktop support|hyflex)\b/i;

const CONSULTING_JD =
  /\b(case interview|problem[- ]solving test|\bpst\b|client engagement|workstream|management consulting|strategy consulting|ibm consulting|associate consultant|successfactors|techno[- ]?functional|strategy insights and planning|decision analytics|desk research|client[- ]first)\b/i;

export function detectRoleFamily(title: string, company: string, description = ""): RoleFamily {
  // Hard SWE/data titles win first — "Associate Software Engineer" at IBM/BCG stays SWE.
  if (SWE_TITLE.test(title)) return "swe";
  if (DATA_ML_TITLE.test(title)) return "data-ml";
  if (CONSULTING_FIRM.test(company) && (CONSULTING_TITLE.test(title) || /\bassociate\b/i.test(title) || CONSULTING_JD.test(title))) {
    return "consulting";
  }
  if (CONSULTING_TITLE.test(title) && CONSULTING_FIRM.test(company)) return "consulting";
  if (ANALYST_TITLE.test(title)) return "analyst";
  if (CONSULTING_TITLE.test(title)) return "analyst";
  if (PRODUCT_TITLE.test(title)) return "product";
  if (INFRA_TITLE.test(title)) return "infra";
  // IBM Consulting / Associate Consultant body copy without a classic MBB title.
  if (CONSULTING_FIRM.test(company) && CONSULTING_JD.test(description.slice(0, 4000))) return "consulting";
  if (CONSULTING_JD.test(`${title}\n${description.slice(0, 4000)}`)) return "consulting";

  const head = `${title}\n${description.slice(0, 2500)}`.toLowerCase();
  const analystHits = (head.match(/\b(excel|powerpoint|stakeholder|workstream|insights?|market research|business analyst|data analyst|competitive intelligence|competitive landscape|segmentation|kpi|brief)\b/g) ?? []).length;
  const sweHits = (head.match(/\b(software engineer|backend|frontend|full[- ]?stack|fastapi|kubernetes|react|kotlin)\b/g) ?? []).length;
  if (analystHits >= 2 && analystHits >= sweHits) return "analyst";
  return "swe";
}

export function isCampusOpsEntry(entry: { company: string; title: string }): boolean {
  return (
    /\bITS\b/i.test(entry.company) ||
    /office assistant|peer mentor|hyflex|lab monitor/i.test(entry.title) ||
    /student services/i.test(entry.company)
  );
}

/** ITS + office-assistant/peer-mentor stay on people/ops-flavored families. */
export function keepCampusOps(family: RoleFamily): boolean {
  return family === "consulting" || family === "analyst" || family === "infra" || family === "product";
}

export function selectExperienceEntries<T extends { company: string; title: string }>(entries: T[], family: RoleFamily): T[] {
  let picked = keepCampusOps(family) ? [...entries] : entries.filter((e) => !isCampusOpsEntry(e));
  const MAX = 4;
  if (picked.length <= MAX) return picked;
  // Five jobs at 2 bullets was the overflow tell. Drop oldest software first
  // so campus-ops + recent internships stay; never ship more than 4.
  const oldestSoftware = [...picked].reverse().filter((e) => !isCampusOpsEntry(e));
  for (const e of oldestSoftware) {
    if (picked.length <= MAX) break;
    picked = picked.filter((x) => x !== e);
  }
  return picked.slice(0, MAX);
}

/** First non-campus-ops entry on the page — the CS/engineering bridge role. */
export function csBridgeEntryIndex(entries: { company: string; title: string }[]): number {
  return entries.findIndex((e) => !isCampusOpsEntry(e));
}

/** Optional ATS seeds — empty for business families so silent JDs stay silent. */
export const SKILL_SEEDS: Partial<Record<RoleFamily, string[]>> = {
  consulting: [],
  analyst: [],
  product: [],
};

export const CONSULTING_RESUME_NORMS = `Taste principles from r/McKinsey_BCG_Bain, r/consulting, and r/zs_associates — principles, not a script. Live Reddit in the payload overrides these when they conflict. When posting_flavor is hr-tech, zs-sip, or zs-da, follow that flavor directive instead of classic MBB partner taste:

- CAR (Context-Analysis-Result), 1-2 lines per bullet. Partners ask: did you diagnose something, drive without a playbook, connect work to time/scale (not invented deal $)?
- "Would a partner understand why it mattered?" If no, rewrite.
- Experience is analysis, stakeholders, recommendations — not FastAPI/CI. Skills hold tools; you choose which intern-defensible tools THIS posting makes relevant. Do NOT list Word.
- Method > product name. Map Tableau/Alteryx JD words onto intern-defensible techniques; never invent those products. Map SuccessFactors/Workday onto process/requirements/UAT language — never invent HRIS product use.
- BCG: tailor headlines so recruiters can compare you to the role. Keep exactly ONE engineer/CS-titled software entry (cs_bridge); other software rows → Analyst language (HR Technology Analyst / Systems Analyst on hr-tech).
- Campus-ops titles stay frozen (HyFlex = classroom/lab restore from source facts; Office Assistant = request tracking + advising). Never Academic WIL. Never Consultant.`;

export const ANALYST_RESUME_NORMS = `Taste principles from r/analytics / insights screens — principles, not a script. Live Reddit + hiring_screen in the payload override these when they conflict:

- Rank skills for THIS posting. Excel/SQL/Python/PowerPoint only when they fit; CI / market research / segmentation / KPI language when the posting makes them real. Never FastAPI, Next.js, Fastify, OpenAI, Node, Word-as-flex.
- Read the full JD first. Competitive intelligence → source monitoring, synthesis of incomplete information, executive-ready briefs. Insights/KPI → question → method → stakeholder use.
- Keep exactly ONE engineer/CS-titled software internship (cs_bridge) with JD-balanced automation + judgment. Other software co-ops → Analyst / Insights language. Campus ops titles frozen.
- Bullets: question → method YOU choose → what a stakeholder did with it. Never default to VLOOKUP/INDEX-MATCH on every resume.
- JD may name Qualtrics/SPSS/Nielsen/PitchBook — map to synthesis / secondary research; do not invent those products.
- Prefer campus ops over a third GitHub project. HyFlex is faculty tech restore, not a docs job.`;

export const PRODUCT_RESUME_NORMS = `Product resumes (r/ProductManagement): users, decisions, tradeoffs, stakeholders — not stack dumps. Skills from the JD. Campus ops mentoring/front-desk is evidence you worked with non-engineers. Keep one CS bridge title.`;

export function resumeNormsFor(family: RoleFamily): string | null {
  if (family === "consulting") return CONSULTING_RESUME_NORMS;
  if (family === "analyst") return ANALYST_RESUME_NORMS;
  if (family === "product") return PRODUCT_RESUME_NORMS;
  return null;
}
