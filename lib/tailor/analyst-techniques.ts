/**
 * Analyst / consulting technique palette — interview-safe ceiling only.
 *
 * The model chooses methods from the JD + Reddit intel. We only match when the
 * posting NAMED a tool/method (or a vendor we must map away from inventing).
 * Bare "excel" / "kpi" / "communicat" must NOT force Pivot or INDEX/MATCH.
 */

import type { RoleFamily } from "./role-family";

export interface AnalystTechnique {
  id: string;
  /** Phrase that may appear in a bullet. */
  writeAs: string;
  /** Why this is on the list (for the model, not the resume). */
  why: string;
  jd: RegExp;
  families: Array<"consulting" | "analyst">;
}

const BOTH: Array<"consulting" | "analyst"> = ["consulting", "analyst"];

/**
 * Intern-defensible techniques. jd patterns are NARROW — named tools/methods
 * only. Hints for the model, never a mandatory stamp list.
 */
export const ANALYST_TECHNIQUE_PALETTE: AnalystTechnique[] = [
  {
    id: "pivot",
    writeAs: "a Pivot Table",
    why: "Only when the JD names pivot tables / Excel pivots",
    jd: /\bpivot(?:\s+tables?)?\b/i,
    families: BOTH,
  },
  {
    id: "index-match",
    writeAs: "INDEX/MATCH",
    why: "Only when the JD names INDEX/MATCH (or INDEX and MATCH)",
    jd: /\bindex\s*\/\s*match\b|\bindex\b.{0,12}\bmatch\b/i,
    families: BOTH,
  },
  {
    id: "xlookup",
    writeAs: "XLOOKUP",
    why: "Only when the JD names XLOOKUP",
    jd: /\bxlookup\b/i,
    families: BOTH,
  },
  {
    id: "vlookup",
    writeAs: "VLOOKUP",
    why: "Only when the JD literally names VLOOKUP",
    jd: /\bvlookup\b/i,
    families: BOTH,
  },
  {
    id: "sumifs",
    writeAs: "SUMIFS",
    why: "Only when the JD names SUMIF(S)/COUNTIF(S)",
    jd: /\bsumifs?\b|\bcountifs?\b/i,
    families: BOTH,
  },
  {
    id: "power-query",
    writeAs: "Power Query",
    why: "JD named Power Query / Power Pivot / Alteryx → map to Power Query, never invent Alteryx use",
    jd: /power query|powerquery|power pivot|\balteryx\b/i,
    families: BOTH,
  },
  {
    id: "sql-join",
    writeAs: "a SQL join",
    why: "JD named SQL / Postgres (not bare 'query' or 'mismatch')",
    jd: /\bsql\b|\bpostgres(?:ql)?\b/i,
    families: BOTH,
  },
  {
    id: "sql-group",
    writeAs: "SQL GROUP BY",
    why: "JD named SQL plus cohort / rollup language",
    jd: /\bsql\b.*\b(cohort|group by|aggregat)|(?:cohort|group by).{0,40}\bsql\b/i,
    families: BOTH,
  },
  {
    id: "deck",
    writeAs: "a PowerPoint deck",
    why: "JD named PowerPoint / decks / slides — not bare 'communication'",
    jd: /powerpoint|power point|\bdecks?\b|\bslides?\b|\bpresentations?\b/i,
    families: BOTH,
  },
  {
    id: "sizing",
    writeAs: "a variance or sizing walkthrough",
    why: "Consulting JD named sizing / forecast / variance / case / workstream",
    jd: /\bsiz(?:e|ing)\b|\bforecast|\bvariance|\bhypothesis|\bcase interview\b|\bworkstream\b/i,
    families: ["consulting"],
  },
  {
    id: "secondary",
    writeAs: "secondary-research synthesis",
    why: "Insights/CI: secondary research or syndicated sources — never invent Nielsen/Qualtrics/PitchBook as tools you used",
    jd: /\bsecondary research\b|\bmarket research\b|\bqualtrics\b|\bnielsen\b|\biri\b|\bcircana\b|\bsurveys?\b|\bsyndicat|\bmintel\b|\bpitchbook\b|\bcb insights\b/i,
    families: ["analyst"],
  },
  {
    id: "competitive-intel",
    writeAs: "a competitive-landscape brief from incomplete sources",
    why: "CI / market-intel postings — source monitoring + synthesis + executive brief",
    jd: /competitive intelligence|market(?:ing)? intelligence|\bcompetitive landscape\b|\bcompetitor\b|\bsource monitor|\bexecutive brief|\bwin.?loss\b|\bthreat assessment\b/i,
    families: ["analyst"],
  },
  {
    id: "cohort",
    writeAs: "a cohort or segmentation cut",
    why: "JD named analytics segmentation / customer cohort — not hiring cohorts",
    jd: /\bsegment(?:ation|s)?\b|\bcustomer cohorts?\b|\banalytics cohorts?\b|\buser cohorts?\b/i,
    families: BOTH,
  },
  {
    id: "workshop",
    writeAs: "a discovery / requirements walkthrough with stakeholders",
    why: "HR-tech / consulting: workshops, discovery, facilitation — map from advising or client walkthroughs",
    jd: /\bworkshops?\b|\bdiscovery\b|\bfacilitat\w*/i,
    families: BOTH,
  },
  {
    id: "requirements",
    writeAs: "a requirements note or process-gap list",
    why: "JD named requirements gathering / user stories / process documentation",
    jd: /\brequirements?\b|\buser stor(?:y|ies)\b|\bprocess (?:gap|map|mapping|notes?)\b/i,
    families: BOTH,
  },
  {
    id: "uat",
    writeAs: "acceptance / test scripts against expected process outcomes",
    why: "JD named UAT, test scripts, or acceptance testing",
    jd: /\buat\b|\btest scripts?\b|\bacceptance test/i,
    families: BOTH,
  },
  {
    id: "sso-map",
    writeAs: "clarified SSO / identity handoff needs with stakeholders",
    why: "JD named SSO / identity — techno-functional clarification, not building auth",
    jd: /\bsso\b|\bsingle sign[- ]?on\b|\bidentity\b|\bokta\b|\bsaml\b/i,
    families: BOTH,
  },
  {
    id: "hris-map",
    writeAs: "HR process + system integration requirements (never invent SuccessFactors/Workday use)",
    why: "JD named SuccessFactors / HRIS / HR technology — map to process/integration language only",
    jd: /successfactors|\bhris\b|\bhr technology\b|\bhcm\b|\bworkday\b|hr systems?/i,
    families: BOTH,
  },
  {
    id: "desk-research",
    writeAs: "desk / secondary research that produced a decision-useful insight",
    why: "ZS SIP and insights: desk/market research — never invent Confirmit/Nielsen as tools you used",
    jd: /\bdesk research\b|\bmarket research\b|\bconfirmit\b|secondary research/i,
    families: BOTH,
  },
  {
    id: "client-synthesis",
    writeAs: "a synthesized recommendation presented to a client or project team",
    why: "ZS / consulting: synthesize and communicate results — oral/written presentations",
    jd: /synthesiz\w*|communicate results|oral and written|client[- ]first|project deliverables/i,
    families: BOTH,
  },
  {
    id: "bi-map",
    writeAs: "a stakeholder-ready dashboard view built from real tables (not a BI product you invent)",
    why: "JD named Tableau/Power BI/Looker — map to intern-defensible reporting; never invent the BI product in experience",
    jd: /tableau|power bi|powerbi|looker|qlik/i,
    families: BOTH,
  },
  {
    id: "python-pipeline",
    writeAs: "a scheduled Python refresh that a stakeholder could trust",
    why: "JD named Python (and optionally pipeline/automation) — bridge-entry language, not FastAPI",
    jd: /\bpython\b/i,
    families: ["analyst", "consulting"],
  },
];

/** JD vocabulary that maps onto the intern-defensible palette — hints, not a script. */
export function matchJdTechniques(jobDescription: string, family: RoleFamily): AnalystTechnique[] {
  if (family !== "consulting" && family !== "analyst") return [];
  const text = jobDescription || "";
  const pool = ANALYST_TECHNIQUE_PALETTE.filter((t) => t.families.includes(family));
  return pool
    .map((t) => ({ t, n: (text.match(t.jd) || []).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.t)
    .slice(0, 4);
}

/**
 * Short brief for the model. Matched JD hints only — do NOT dump every writeAs
 * phrase (that was steering every resume toward Pivot/INDEX-MATCH).
 */
export function techniqueBrief(jobDescription: string, family: RoleFamily): string {
  if (family !== "consulting" && family !== "analyst") return "";
  const hinted = matchJdTechniques(jobDescription, family);
  return [
    "METHOD FREEDOM: You invent the analysis approach for THIS posting from the JD, Reddit hiring-screen intel, and real source facts. Do not stamp a Pivot / INDEX-MATCH / Power Query template.",
    "Interview-safe ceiling (you may use these IF they fit; you are not required to): Excel techniques, SQL, Python, PowerPoint, secondary-research synthesis, dashboards built in Excel, competitive-landscape briefs, requirements notes, workshop/discovery walkthroughs, UAT/test scripts, desk/market research. Segmentation only when the JD truly asks for it. Never invent Tableau, Power BI, Alteryx, Qualtrics, Nielsen, IQVIA, SPSS, Salesforce, CRM, PitchBook, CB Insights, Think-Cell, SuccessFactors, Workday, Confirmit, Microsoft Access, SAS, VBA, or Hadoop as something you used — if the JD names them, map to an intern-defensible equivalent (Excel, Python, SQL, secondary research).",
    "Write VLOOKUP only if the JD literally contains VLOOKUP. Word is assumed — do not list it.",
    hinted.length
      ? "JD named these (hints only — you still decide wording):\n" +
        hinted.map((t) => `- ${t.writeAs} [${t.id}]: ${t.why}`).join("\n")
      : "This posting named no analysis tools. Prefer diagnosis → method you choose → stakeholder use. Do not fill space with Pivot Tables, INDEX/MATCH, or Power Query.",
  ].join("\n");
}

export type BusinessSkillBucket = "languages" | "infra" | "frameworks" | "cloud";

/**
 * Always-on skills are intentionally empty. The model ranks from the verified
 * pool. We only strip SWE leaks and invented vendors.
 */
export const BUSINESS_SKILL_CORE: Record<BusinessSkillBucket, string[]> = {
  languages: [],
  infra: [],
  frameworks: [],
  cloud: [],
};

const TECHNIQUE_SKILL: Record<string, { item: string; bucket: BusinessSkillBucket }> = {
  pivot: { item: "Pivot Tables", bucket: "infra" },
  "index-match": { item: "INDEX/MATCH", bucket: "infra" },
  xlookup: { item: "XLOOKUP", bucket: "infra" },
  vlookup: { item: "VLOOKUP", bucket: "infra" },
  sumifs: { item: "SUMIFS", bucket: "infra" },
  "power-query": { item: "Power Query", bucket: "infra" },
  deck: { item: "PowerPoint", bucket: "infra" },
  "sql-join": { item: "SQL", bucket: "languages" },
  "sql-group": { item: "SQL", bucket: "languages" },
  secondary: { item: "Secondary Research", bucket: "frameworks" },
  "competitive-intel": { item: "Competitive Intelligence", bucket: "frameworks" },
  cohort: { item: "Segmentation", bucket: "frameworks" },
  workshop: { item: "Workshop Facilitation", bucket: "frameworks" },
  requirements: { item: "Requirements Gathering", bucket: "frameworks" },
  uat: { item: "UAT / Test Scripts", bucket: "frameworks" },
  "sso-map": { item: "Process Mapping", bucket: "frameworks" },
  "hris-map": { item: "Process Mapping", bucket: "frameworks" },
  "desk-research": { item: "Market Research", bucket: "cloud" },
  "client-synthesis": { item: "Stakeholder Communication", bucket: "frameworks" },
  "bi-map": { item: "Dashboard Reporting", bucket: "cloud" },
  "python-pipeline": { item: "Python", bucket: "languages" },
};

/**
 * Intern-defensible extras scored against THIS posting. Tableau/IQVIA/Qualtrics
 * in the JD map onto Dashboard Reporting / Market Research / Secondary Research
 * — never onto the vendor name.
 */
const BUSINESS_JD_EXTRAS: { item: string; bucket: BusinessSkillBucket; jd: RegExp }[] = [
  { item: "XLOOKUP", bucket: "infra", jd: /\bxlookup\b/i },
  { item: "VLOOKUP", bucket: "infra", jd: /\bvlookup\b/i },
  { item: "SUMIFS", bucket: "infra", jd: /\bsumifs?\b|\bcountifs?\b/i },
  { item: "Pivot Tables", bucket: "infra", jd: /\bpivot(?:\s+tables?)?\b/i },
  { item: "INDEX/MATCH", bucket: "infra", jd: /\bindex\s*\/\s*match\b/i },
  { item: "Power Query", bucket: "infra", jd: /power query|powerquery|power pivot|\balteryx\b/i },
  { item: "PowerPoint", bucket: "infra", jd: /powerpoint|power point|\bdecks?\b|\bslides?\b/i },
  { item: "Excel", bucket: "infra", jd: /\bexcel\b|\bmicrosoft excel\b/i },
  { item: "SQL", bucket: "languages", jd: /\bsql\b|\bpostgres(?:ql)?\b/i },
  { item: "Python", bucket: "languages", jd: /\bpython\b/i },
  { item: "JavaScript", bucket: "languages", jd: /\bjava\s*script\b|\bjavascript\b|\bjs\b/i },
  { item: "REST APIs", bucket: "cloud", jd: /\bapis?\b|\brest\b|\bhr apis?\b/i },
  {
    item: "Secondary Research",
    bucket: "frameworks",
    jd: /\bsecondary research\b|\bmarket research\b|\bqualtrics\b|\bnielsen\b|\biri\b|\bcircana\b|\bsurveys?\b|\bsyndicat|\bmintel\b|\bpitchbook\b|\bcb insights\b/i,
  },
  {
    item: "Competitive Intelligence",
    bucket: "frameworks",
    jd: /competitive intelligence|market(?:ing)? intelligence|\bcompetitive landscape\b|\bcompetitor analysis\b|\bwin.?loss\b/i,
  },
  {
    item: "Segmentation",
    bucket: "frameworks",
    jd: /\bsegment(?:ation|s)?\b|\bcustomer cohorts?\b|\banalytics cohorts?\b|\buser cohorts?\b/i,
  },
  {
    item: "Requirements Gathering",
    bucket: "frameworks",
    jd: /\brequirements?\b|\buser stor(?:y|ies)\b|\banalyz(?:e|ing) client requirements\b/i,
  },
  {
    item: "Workshop Facilitation",
    bucket: "frameworks",
    jd: /\bworkshops?\b|\bdiscovery\b|\bfacilitat\w*/i,
  },
  {
    item: "UAT / Test Scripts",
    bucket: "frameworks",
    jd: /\buat\b|\btest scripts?\b|\bacceptance test|\btest (?:the )?system\b/i,
  },
  {
    item: "Process Mapping",
    bucket: "frameworks",
    jd: /successfactors|\bhris\b|\bhr technology\b|\bworkday\b|\bsso\b|people processes?|process mapping/i,
  },
  {
    item: "Desk Research",
    bucket: "frameworks",
    jd: /\bdesk research\b|\bconfirmit\b/i,
  },
  {
    item: "Market Research",
    bucket: "cloud",
    jd: /market research|competitive intelligence|pharmaceutical market|consumer insights|competitive landscape|desk research/i,
  },
  {
    item: "Dashboard Reporting",
    bucket: "cloud",
    jd: /dashboard|tableau|power bi|powerbi|looker|qlik/i,
  },
  { item: "KPI Tracking", bucket: "cloud", jd: /\bkpis?\b|product performance|performance driver/i },
  {
    item: "Statistical Analysis",
    bucket: "frameworks",
    jd: /statistical models?|econometrics|operations research|applied mathematics|data science|statistics/i,
  },
];

/** Vendors the candidate must not list as skills or experience. */
export const BUSINESS_NEVER_INVENT =
  /\b(?:tableau|power bi|powerbi|alteryx|qualtrics|nielsen|iqvia|spss|sas|think-?cell|salesforce|\bcrm\b|confluence|notion|airtable|pitchbook|cb insights|successfactors|workday|sap successfactors|confirmit|microsoft access|\bvba\b|visual basic|\bhadoop\b)\b/i;

function dedupeSkills(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** JD-scored intern-defensible extras. Never a forced Excel-function dump. */
export function claimableBusinessSkillItems(jobDescription: string, family: RoleFamily = "consulting"): string[] {
  const fromTech = matchJdTechniques(jobDescription, family)
    .map((t) => TECHNIQUE_SKILL[t.id]?.item)
    .filter((x): x is string => Boolean(x));
  return dedupeSkills([
    ...fromTech,
    ...BUSINESS_JD_EXTRAS.filter((e) => e.jd.test(jobDescription)).map((e) => e.item),
  ]);
}

export function clampBusinessSkillLine(items: string[], max: number): string[] {
  if (max <= 0 || items.length <= max) return items;
  return items.slice(0, max);
}
