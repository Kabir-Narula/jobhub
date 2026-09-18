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
 * Intern-defensible techniques the model may write. Order is the default
 * consulting pick when the JD names nothing (Pivot / INDEX-MATCH / deck / SQL),
 * not VLOOKUP.
 */
export const ANALYST_TECHNIQUE_PALETTE: AnalystTechnique[] = [
  {
    id: "pivot",
    writeAs: "a Pivot Table",
    why: "PrepLounge + r/consulting: the actual Excel analysis unit, not 'used Excel'",
    jd: /\bpivot|\bexcel\b|dashboard|aggregat|summar|kpi/i,
    families: BOTH,
  },
  {
    id: "index-match",
    writeAs: "INDEX/MATCH",
    why: "PrepLounge: connecting datasets. Replaces VLOOKUP as the lookup seniors still probe",
    jd: /\bexcel\b|lookup|reconcil|match|\bjoin\b|vlookup|xlookup/i,
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
    jd: /power query|powerquery|power pivot|alteryx|clean(?:ing)? data|transform/i,
    families: BOTH,
  },
  {
    id: "sql-join",
    writeAs: "a SQL join",
    why: "r/consulting: SQL when Excel dies on size. Candidate has real SQL",
    jd: /\bsql\b|postgres|reconcil|mismatch|query/i,
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
    jd: /powerpoint|power point|deck|slide|present|communicat|story/i,
    families: BOTH,
  },
  {
    id: "sizing",
    writeAs: "a variance or sizing walkthrough",
    why: "r/McKinsey_BCG_Bain: diagnosis that informed a go/no-go, intern-scale",
    jd: /siz(?:e|ing)|forecast|variance|hypothesis|market|case/i,
    families: ["consulting"],
  },
  {
    id: "secondary",
    writeAs: "secondary-research synthesis",
    why: "Insights ATS: secondary data, syndicated sources. Do not invent Nielsen/Qualtrics",
    jd: /secondary|insights?|market research|syndicat|nielsen|iri|circana|qualtrics|survey|mintel/i,
    families: ["analyst"],
  },
  {
    id: "cohort",
    writeAs: "a cohort or segmentation cut",
    why: "Insights ATS: segmentation / cohort. Method, not SPSS",
    jd: /cohort|segment|cluster|consumer/i,
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

const DEFAULT_CONSULTING = ["pivot", "index-match", "deck", "sql-join"];
const DEFAULT_ANALYST = ["pivot", "sql-join", "secondary", "cohort"];

export function matchJdTechniques(jobDescription: string, family: RoleFamily): AnalystTechnique[] {
  if (family !== "consulting" && family !== "analyst") return [];
  const text = jobDescription || "";
  const pool = ANALYST_TECHNIQUE_PALETTE.filter((t) => t.families.includes(family));
  const scored = pool
    .map((t) => ({ t, n: (text.match(t.jd) || []).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.t);
  if (scored.length >= 3) return scored.slice(0, 4);
  const fallbackIds = family === "analyst" ? DEFAULT_ANALYST : DEFAULT_CONSULTING;
  const seen = new Set(scored.map((t) => t.id));
  const out = [...scored];
  for (const id of fallbackIds) {
    if (out.length >= 4) break;
    const t = pool.find((p) => p.id === id);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out.slice(0, 4);
}

/** Payload block: GPT must run this matching step before writing bullets. */
export function techniqueBrief(jobDescription: string, family: RoleFamily): string {
  if (family !== "consulting" && family !== "analyst") return "";
  const picked = matchJdTechniques(jobDescription, family);
  const palette = ANALYST_TECHNIQUE_PALETTE.filter((t) => t.families.includes(family))
    .map((t) => `- ${t.writeAs} [${t.id}]: ${t.why}`)
    .join("\n");
  return [
    "ANALYSIS TOOL STEP — do this BEFORE writing any bullet (strict, high priority):",
    "1. Read job.description and company_research.stack against the palette below.",
    "2. Use jd_matched_techniques (already scored for THIS posting) as the default pick.",
    "3. Spread 2-4 techniques across the resume. One technique must not appear at two employers.",
    "4. NEVER default to VLOOKUP. r/consulting and PrepLounge treat VLOOKUP as minimum Excel, not a story. Prefer Pivot Tables, INDEX/MATCH, XLOOKUP (only if named), SUMIFS, Power Query, SQL JOIN/GROUP BY, or a PowerPoint deck — whichever the posting actually implies.",
    "5. Write VLOOKUP only if the JD literally contains VLOOKUP.",
    "6. Never invent Alteryx, Tableau, SPSS, Qualtrics, Nielsen, Think-Cell, or Power BI in experience. If the JD names those, write the mapped intern-defensible equivalent (Power Query for Alteryx, a pivot for Tableau/Power BI, secondary-research synthesis for Qualtrics/Nielsen).",
    "7. Word is assumed (Hacking the Case Interview 2026). Do not list Word as a flex and do not stamp it in bullets.",
    "",
    "jd_matched_techniques for this posting:",
    picked.map((t) => `- ${t.writeAs} (${t.id}) — ${t.why}`).join("\n") || "- (none — use consulting defaults: Pivot Table, INDEX/MATCH, PowerPoint deck, SQL join)",
    "",
    "full intern-defensible palette:",
    palette,
  ].join("\n");
}

/** Skills pin: real analysis vocabulary, not a VLOOKUP/Word stamp. */
export const BUSINESS_SKILL_CORE: Record<"languages" | "infra" | "frameworks" | "cloud", string[]> = {
  languages: ["SQL", "Python"],
  infra: ["Excel", "Pivot Tables", "Power Query", "INDEX/MATCH", "PowerPoint", "Jira"],
  frameworks: ["Git"],
  cloud: ["PostgreSQL"],
};

export function businessSkillPin(label: string): string[] | null {
  const k = label.replace(/\\/g, "").toLowerCase();
  if (k.includes("language")) return BUSINESS_SKILL_CORE.languages;
  if (k.includes("infra")) return BUSINESS_SKILL_CORE.infra;
  if (k.includes("framework")) return BUSINESS_SKILL_CORE.frameworks;
  if (k.includes("cloud")) return BUSINESS_SKILL_CORE.cloud;
  return null;
}
