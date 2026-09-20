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
  /\b(mckinsey|boston consulting|\bbcg\b|bain\b|deloitte|pwc|pricewaterhouse|\bey\b|ernst\s*[&+]\s*young|kpmg|oliver wyman|strategy&|kearney|roland berger|\blek\b|accenture|alvarez\s*[&+]\s*marsal|parthenon)\b/i;

const CONSULTING_TITLE =
  /\b((business|strategy|management)[- ]?(analyst|associate|consultant)|associate consultant|junior associate|case team|generalist)\b/i;

const ANALYST_TITLE =
  /\b((business|data|insights?|research|operations|market|marketing|financial|risk|pricing|reporting|bi|business intelligence)[- ]?(analyst|associate)|insights? (associate|manager)|research associate)\b/i;

const PRODUCT_TITLE = /\b(product (manager|owner|analyst|associate)|program manager|tpm\b)\b/i;

const INFRA_TITLE =
  /\b(devops|sre|site reliability|platform engineer|it (support|analyst|consultant)|help ?desk|systems? admin|technical support|desktop support|hyflex)\b/i;

const CONSULTING_JD =
  /\b(case interview|problem[- ]solving test|\bpst\b|client engagement|workstream|management consulting|strategy consulting)\b/i;

export function detectRoleFamily(title: string, company: string, description = ""): RoleFamily {
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
  if (CONSULTING_FIRM.test(company) && CONSULTING_JD.test(description.slice(0, 2500))) return "consulting";
  if (CONSULTING_JD.test(`${title}\n${description.slice(0, 2500)}`)) return "consulting";

  const head = `${title}\n${description.slice(0, 2500)}`.toLowerCase();
  const analystHits = (head.match(/\b(excel|powerpoint|stakeholder|workstream|insights?|market research|business analyst|data analyst)\b/g) ?? []).length;
  const sweHits = (head.match(/\b(software engineer|backend|frontend|full[- ]?stack|fastapi|kubernetes|react|kotlin)\b/g) ?? []).length;
  if (analystHits >= 3 && analystHits > sweHits) return "analyst";
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

export const SKILL_SEEDS: Partial<Record<RoleFamily, string[]>> = {
  consulting: ["excel", "powerpoint", "sql", "python"],
  analyst: ["excel", "powerpoint", "sql", "python", "dashboard"],
  product: ["excel", "jira"],
};

export const CONSULTING_RESUME_NORMS = `Real Reddit lines from r/McKinsey_BCG_Bain and r/consulting about what these resumes must look like — follow them:

- "Each of your bullets has to be in Context - Analysis - Results format (could be CAR/RAC/RCA). Each bullet must be max 1-2 lines."
- "Consulting screens for: did you diagnose something, not just execute? did you drive something without a playbook? can you connect your work to dollars, time, or scale?"
- "The resume that gets through at McK or BCG reads like: identified an opportunity through analysis, directly informing the go/no-go decision." Same SHAPE for an intern: diagnosis → analysis → a decision or a process that stopped needing a chase. Do NOT invent deal sizes or $ millions.
- "Would a partner reading this understand why it mattered?" If no, rewrite.
- "No need to list out technical skills in experience (consulting don't care)." Experience is analysis, stakeholders, recommendations — not FastAPI/CI.
- "Skills line for consulting/strategy: Figma isn't relevant. Lead with Excel, Tableau, R, PowerPoint. Add PowerPoint to qualifications." Hacking the Case Interview 2026: do NOT list Word — it is assumed.
- "Describe the data analysis you did: a pivot, a variance, a regression, a sizing — not 'used Excel'." r/consulting: Power Query / Power Pivot keep Excel alive; "Alteryx for cookin, Tableau for lookin" — map those JD words onto intern-defensible techniques, never invent Alteryx/Tableau in experience.
- PrepLounge MBB tools in order: PowerPoint, Excel (Pivot Tables, INDEX/MATCH, SUMIFS — VLOOKUP is minimum Excel, not a story), then Alteryx/Tableau if you actually have them.
- BCG recruiters: "Tailor your headlines so the recruiter can compare you to the role. Mix the role and what you achieved."
- Translate software internships into consulting language: a weekly export ops ran by hand becomes a Pivot Table or SQL join plus a stakeholder walkthrough; a bug hunt becomes reconciling a number mismatch so the report went out. Name the technique the posting implies (from jd_matched_techniques). Never default to VLOOKUP.
- Campus ops roles are load-bearing: keep them. Four experience entries, three CAR bullets each — never five stub jobs, never two-bullet stubs. Drop the oldest freelance software role if the page would otherwise go to two-bullet stubs.
- HyFlex (ITS Lab Monitor): the job is front-line troubleshooting for professors and labs — restore audio, display, camera, login, peripherals across 30+ HyFlex rooms, in person and remotely. You resolved the issue. At most ONE later bullet documents a recurring pattern after the fix. Never rewrite this as Excel trackers or Word notices.
- Office Assistant: one request tracker using a lookup or filter from jd_matched_techniques (INDEX/MATCH, XLOOKUP, SUMIFS — VLOOKUP only if the JD names it) + one-on-one advising. Never HyFlex equipment. Never put "faculty notices" or "paper logs dropped follow-ups" on both jobs.
- Never write "Academic WIL" if the role was a co-op. HyFlex is contract part-time, not a co-op. Freeze those parentheticals.`;

export const ANALYST_RESUME_NORMS = `Real Reddit lines from r/analytics, r/datascience, and r/consulting about analyst / insights resumes:

- Lead skills with Excel (Pivot Tables, INDEX/MATCH, Power Query), SQL, PowerPoint, then Python if you actually used it for analysis — not FastAPI, Next.js, Fastify, OpenAI, Node, or Word-as-flex. Add posting-matched Dashboard Reporting / KPI Tracking / Market Research / Secondary Research. Always a Professional line. Never Git as the whole Frameworks line.
- Bullets are question → method from jd_matched_techniques (pivot, SQL join, cohort, secondary synthesis) → what a stakeholder did with it. "Used Excel" is not a bullet. Never default to VLOOKUP.
- Insights/market-research screens look for synthesis: secondary research, segmentation, a pattern someone used. JD may name Qualtrics/SPSS/Nielsen — map to secondary-research synthesis, do not invent those products.
- Do not write data-engineering bullets (Spark, ETL platforms, CI) for a Data Analyst / Insights Associate posting.
- Campus ops (office assistant, peer mentor) is relevant: operational trackers, documentation, advising, passing themes to leadership. Prefer that over a third GitHub project.
- HyFlex is classroom/lab troubleshooting for faculty, not a documentation job.`;

export const PRODUCT_RESUME_NORMS = `Product resumes (r/ProductManagement): users, decisions, tradeoffs, stakeholders — not stack dumps. Excel/Jira in skills. Campus ops mentoring/front-desk is evidence you worked with non-engineers.`;

export function resumeNormsFor(family: RoleFamily): string | null {
  if (family === "consulting") return CONSULTING_RESUME_NORMS;
  if (family === "analyst") return ANALYST_RESUME_NORMS;
  if (family === "product") return PRODUCT_RESUME_NORMS;
  return null;
}
