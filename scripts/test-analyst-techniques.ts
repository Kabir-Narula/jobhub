/**
 * Technique matching for consulting/insights resumes.
 * Run: npx tsx scripts/test-analyst-techniques.ts
 */
import { matchJdTechniques, BUSINESS_SKILL_CORE, claimableBusinessSkillItems } from "../lib/tailor/analyst-techniques";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const silent = matchJdTechniques("Drive, creativity, intelligence, lead and persuade.", "consulting").map((t) => t.id);
check(
  "a tool-silent BCG JD does not default to VLOOKUP",
  silent.includes("pivot") && silent.includes("index-match") && !silent.includes("vlookup"),
  silent.join(", ")
);

const tableau = matchJdTechniques("Build Tableau dashboards and Power BI reports for stakeholders. Tableau Tableau.", "consulting").map(
  (t) => t.id
);
check("a Tableau JD maps to a pivot/dashboard equivalent, not invented Tableau experience", tableau.includes("bi-map"), tableau.join(", "));
check("a Tableau JD still does not force VLOOKUP", !tableau.includes("vlookup"), tableau.join(", "));

const sqlJd = matchJdTechniques("Strong SQL required. SQL joins across Postgres. SQL SQL.", "consulting").map((t) => t.id);
check("a SQL-heavy JD picks a SQL join", sqlJd.includes("sql-join"), sqlJd.join(", "));

const vlookupJd = matchJdTechniques("Must know VLOOKUP. VLOOKUP VLOOKUP in Excel.", "consulting").map((t) => t.id);
check("VLOOKUP is selected only when the JD names it", vlookupJd.includes("vlookup"), vlookupJd.join(", "));

const insights = matchJdTechniques(
  "Insights Associate. Secondary data, market research, consumer segmentation, Qualtrics surveys, Nielsen panels.",
  "analyst"
).map((t) => t.id);
check("an insights JD picks secondary research, not VLOOKUP", insights.includes("secondary") && !insights.includes("vlookup"), insights.join(", "));

check("consulting skills pin is Pivot Tables / Power Query, not VLOOKUP or Word", BUSINESS_SKILL_CORE.infra.includes("Pivot Tables"));
check("consulting skills pin includes Power Query", BUSINESS_SKILL_CORE.infra.includes("Power Query"));
check("consulting skills pin includes INDEX/MATCH", BUSINESS_SKILL_CORE.infra.includes("INDEX/MATCH"));
check("consulting skills pin includes PowerPoint", BUSINESS_SKILL_CORE.infra.includes("PowerPoint"));
check("consulting skills pin does not stamp VLOOKUP", !BUSINESS_SKILL_CORE.infra.includes("VLOOKUP"));
check("consulting skills pin does not stamp Word", !BUSINESS_SKILL_CORE.infra.includes("Microsoft Word"));
check("consulting Frameworks is Agile/Scrum, not Git", BUSINESS_SKILL_CORE.frameworks.includes("Agile/Scrum") && !BUSINESS_SKILL_CORE.frameworks.includes("Git"));

const lillySkills = claimableBusinessSkillItems(
  "Design dashboards and reports to monitor KPIs. Market research and competitive intelligence. IQVIA, Qualtrics, Tableau."
);
check("Lilly JD claimable skills include Dashboard Reporting and KPI Tracking", lillySkills.includes("Dashboard Reporting") && lillySkills.includes("KPI Tracking"), lillySkills.join(", "));
check("Lilly JD claimable skills never list IQVIA or Tableau", !lillySkills.includes("IQVIA") && !lillySkills.includes("Tableau") && !lillySkills.includes("Qualtrics"), lillySkills.join(", "));
const bcgSkills = claimableBusinessSkillItems("Drive, creativity, intelligence, lead and persuade.");
check("silent BCG JD does not add Market Research", !bcgSkills.includes("Market Research") && !bcgSkills.includes("Dashboard Reporting"), bcgSkills.join(", "));

check("SWE family gets no analyst techniques", matchJdTechniques("Excel SQL Tableau", "swe").length === 0);

console.log(failures === 0 ? "all analyst-technique checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
