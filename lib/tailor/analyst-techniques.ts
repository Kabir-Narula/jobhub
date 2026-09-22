/**
 * Analyst / consulting technique palette.
 *
 * Sourced, not guessed:
 * - r/consulting "Excel is king" / "What data analysis tools do MBB use":
 *   Power Query + Power Pivot in Excel; "Alteryx for cookin, Tableau for lookin";
 *   SQL when the set is large; VLOOKUP is table-stakes, not a differentiator.
 * - PrepLounge MBB computer-skills thread: PowerPoint, Excel
 *   (SUM/SUMPRODUCT, CONCAT, VLOOKUP/HLOOKUP/INDEX-MATCH, SUMIF/COUNTIFS,
 *   Pivot Tables), then Alteryx, Tableau. Word "rarely used now".
 * - Hacking the Case Interview MBA consulting resume (2026): list Excel, SQL,
 *   Tableau, Python, PowerPoint. Do NOT list Word or Google Docs — assumed.
 * - Insights / market-research ATS (2026): Qualtrics, SPSS, Nielsen/IRI/Circana,
 *   secondary research, segmentation, Tableau/Power BI. Method > product name.
 * - BCG campus Associate JD: almost no tools named. Problem-solving, analysis,
 *   decks. Do not stamp a lookup function because the posting is silent.
 *
 * This candidate can defend Excel techniques, SQL, Python, PowerPoint.
 * Alteryx / Tableau / SPSS / Qualtrics / Nielsen are JD vocabulary to MAP onto
 * those, never to invent as experience.
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
 * Intern-defensible techniques the model may write. Hints only — never a
 * default dump when the posting names no tools.
 */
export const ANALYST_TECHNIQUE_PALETTE: AnalystTechnique[] = [
  {
    id: "pivot",
    writeAs: "a Pivot Table",
    why: "PrepLounge + r/consulting: the actual Excel analysis unit, not 'used Excel'",
    jd: /\bpivot(?:\s+tables?)?\b|\bexcel\b|\bdashboards?\b|\baggregat|\bkpis?\b/i,
    families: BOTH,
  },
  {
    id: "index-match",
    writeAs: "INDEX/MATCH",
    why: "PrepLounge: connecting datasets. Replaces VLOOKUP as the lookup seniors still probe",
    jd: /\bexcel\b|\blookups?\b|\breconcil|\bindex\s*\/\s*match\b|\bvlookup\b|\bxlookup\b/i,
    families: BOTH,
  },
  {
    id: "xlookup",
    writeAs: "XLOOKUP",
    why: "Modern Excel lookup. Use only when the JD or stack says lookup/XLOOKUP, not as a default",
    jd: /\bxlookup\b/i,
    families: BOTH,
  },
  {
    id: "vlookup",
    writeAs: "VLOOKUP",
    why: "Legacy lookup. r/consulting treats it as minimum Excel, not a flex. Only if the JD names it",
    jd: /\bvlookup\b/i,
    families: BOTH,
  },
  {
    id: "sumifs",
    writeAs: "SUMIFS",
    why: "PrepLounge core Excel: conditional aggregation for KPIs",
    jd: /\bsumifs?\b|\bcountifs?\b|\bkpi/i,
    families: BOTH,
  },
  {
    id: "power-query",
    writeAs: "Power Query",
    why: "r/consulting: Power Query (and Power Pivot) is how Excel stays alive vs Alteryx",
    jd: /power query|powerquery|power pivot|\balteryx\b|clean(?:ing)? data/i,
    families: BOTH,
  },
  {
    id: "sql-join",
    writeAs: "a SQL join",
    why: "r/consulting: SQL when Excel dies on size. Candidate has real SQL",
    jd: /\bsql\b|\bpostgres(?:ql)?\b|\breconcil|\bmismatch\b|\bquer(?:y|ies)\b/i,
    families: BOTH,
  },
  {
    id: "sql-group",
    writeAs: "SQL GROUP BY",
    why: "Cohort / rollup work without inventing Tableau",
    jd: /\bsql\b|cohort|group by|aggregat/i,
    families: BOTH,
  },
  {
    id: "deck",
    writeAs: "a PowerPoint deck",
    why: "PrepLounge #1 MBB tool. Action-title slides, not 'used PowerPoint'",
    jd: /powerpoint|power point|\bdecks?\b|\bslides?\b|\bpresent(?:ation|ing)?\b|\bcommunicat/i,
    families: BOTH,
  },
  {
    id: "sizing",
    writeAs: "a variance or sizing walkthrough",
    why: "r/McKinsey_BCG_Bain: diagnosis that informed a go/no-go, intern-scale",
    jd: /\bsiz(?:e|ing)\b|\bforecast|\bvariance|\bhypothesis|\bmarket(?:ing)?\b|\bcase interview\b|\bworkstream\b/i,
    families: ["consulting"],
  },
  {
    id: "secondary",
    writeAs: "secondary-research synthesis",
    why: "Insights ATS: secondary data, syndicated sources. Do not invent Nielsen/Qualtrics",
    jd: /secondary|\bmarket research\b|\bqualtrics\b|\bnielsen\b|\biri\b|\bcircana\b|\bsurveys?\b|\bsyndicat|\bmintel\b/i,
    families: ["analyst"],
  },
  {
    id: "cohort",
    writeAs: "a cohort or segmentation cut",
    why: "Insights ATS: segmentation / cohort. Method, not SPSS",
    jd: /\bcohort|\bsegment(?:ation|s)?\b|\bcluster|\bconsumer\b/i,
    families: BOTH,
  },
  {
    id: "bi-map",
    writeAs: "an Excel pivot a stakeholder could read like a dashboard",
    why: "JD named Tableau/Power BI/Looker — map to a real pivot, never invent the BI product in experience",
    jd: /tableau|power bi|powerbi|looker|qlik/i,
    families: BOTH,
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

/** Capability menu for the model. Do not treat this as a mandatory dump. */
export function techniqueBrief(jobDescription: string, family: RoleFamily): string {
  if (family !== "consulting" && family !== "analyst") return "";
  const hinted = matchJdTechniques(jobDescription, family);
  const palette = ANALYST_TECHNIQUE_PALETTE.filter((t) => t.families.includes(family))
    .map((t) => `- ${t.writeAs} [${t.id}]: ${t.why}`)
    .join("\n");
  return [
    "You choose methods for THIS posting. The palette is what this candidate can defend in an interview — not a list to stamp on every resume.",
    "Read job.description and pick intern-defensible analysis that actually fits. A tool-silent BCG/McKinsey posting may need no Excel function names at all. An insights posting may need synthesis, KPIs, or dashboards.",
    "Never invent Tableau, Power BI, Alteryx, Qualtrics, Nielsen, IQVIA, SPSS, Salesforce, CRM, or Think-Cell as something you used. If the JD names those, map to a palette equivalent.",
    "Write VLOOKUP only if the JD literally contains VLOOKUP. Word is assumed — do not list it.",
    "",
    hinted.length
      ? "JD vocabulary that maps onto the palette (hints only — you still decide):\n" + hinted.map((t) => `- ${t.writeAs} (${t.id})`).join("\n")
      : "This posting named no analysis tools. Do not fill space with Pivot Tables, INDEX/MATCH, or Power Query.",
    "",
    "intern-defensible palette (interview-safe ceiling):",
    palette,
  ].join("\n");
}

export type BusinessSkillBucket = "languages" | "infra" | "frameworks" | "cloud";

/**
 * Always-on skills are intentionally empty. The model ranks from the verified
 * pool + intern-defensible extras. We only strip SWE leaks and invented vendors.
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
  cohort: { item: "Segmentation", bucket: "frameworks" },
  "bi-map": { item: "Dashboard Reporting", bucket: "cloud" },
};

/**
 * Intern-defensible extras scored against THIS posting. Tableau/IQVIA/Qualtrics
 * in the JD map onto Dashboard Reporting / Market Research / Secondary Research
 * — never onto the vendor name (candidate has not used those products).
 */
const BUSINESS_JD_EXTRAS: { item: string; bucket: BusinessSkillBucket; jd: RegExp }[] = [
  { item: "XLOOKUP", bucket: "infra", jd: /\bxlookup\b/i },
  { item: "VLOOKUP", bucket: "infra", jd: /\bvlookup\b/i },
  { item: "SUMIFS", bucket: "infra", jd: /\bsumifs?\b|\bcountifs?\b/i },
  {
    item: "Secondary Research",
    bucket: "frameworks",
    jd: /secondary|\bmarket research\b|\bqualtrics\b|\bnielsen\b|\biri\b|\bcircana\b|\bsurveys?\b|\bsyndicat|\bmintel\b/i,
  },
  { item: "Segmentation", bucket: "frameworks", jd: /\bsegment(?:ation|s)?\b|\bcohort|\bcluster|\bconsumer\b/i },
  {
    item: "Market Research",
    bucket: "cloud",
    jd: /market research|competitive intelligence|pharmaceutical market|consumer insights/i,
  },
  {
    item: "Dashboard Reporting",
    bucket: "cloud",
    jd: /dashboard|tableau|power bi|powerbi|looker|qlik/i,
  },
  { item: "KPI Tracking", bucket: "cloud", jd: /\bkpis?\b|product performance|performance driver/i },
];

/** Vendors the candidate must not list as skills or experience. */
export const BUSINESS_NEVER_INVENT =
  /\b(?:tableau|power bi|powerbi|alteryx|qualtrics|nielsen|iqvia|spss|sas|think-?cell|salesforce|\bcrm\b)\b/i;

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
