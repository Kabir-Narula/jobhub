/**
 * Role-family classifier, campus-ops keep/drop, analyst vs SWE lenses.
 * Run: npx tsx scripts/test-role-family.ts
 */
import {
  detectRoleFamily,
  isCampusOpsEntry,
  selectExperienceEntries,
  keepCampusOps,
} from "../lib/tailor/role-family";
import { detectLens } from "../lib/tailor/lens";
import { isTechTerm } from "../lib/tailor/match";
import { softSkillsFor } from "../lib/tailor/soft-skills";
import { projectSlots } from "../lib/tailor/projects";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`ok    ${name}`);
  }
}

check(
  "McKinsey Business Analyst is consulting",
  detectRoleFamily("Business Analyst", "McKinsey & Company", "") === "consulting"
);
check(
  "BCG Associate (campus) is consulting",
  detectRoleFamily("Associate, Western Canadian Universities, Canada", "Boston Consulting Group", "") === "consulting"
);
check(
  "Lilly Insights Associate is analyst, not data-engineering",
  detectRoleFamily("Insights Associate/Sr Associate/Manager", "Eli Lilly and Company", "analytics dashboards python spark") ===
    "analyst"
);
check(
  "Data Analyst is analyst",
  detectRoleFamily("Data Analyst", "Shopify", "Excel SQL Tableau") === "analyst"
);
check(
  "Data Engineer is data-ml",
  detectRoleFamily("Data Engineer", "Shopify", "Spark ETL") === "data-ml"
);
check(
  "analytics in an Insights JD does not become the data-engineering lens",
  detectLens(
    "Insights Associate",
    "analytics dashboards python spark etl databricks data pipeline analytics analytics",
    "Eli Lilly and Company"
  )?.id === "analyst"
);
check(
  "McKinsey BA lens is consulting",
  detectLens("Business Analyst", "problem solving client teams excel powerpoint", "McKinsey & Company")?.id === "consulting"
);
check(
  "Software Engineer at McKinsey Digital stays SWE",
  detectRoleFamily("Software Engineer", "McKinsey & Company", "Java Python Kubernetes") === "swe"
);
check(
  "a FastAPI backend posting is SWE",
  detectRoleFamily("Backend Software Developer", "Stripe", "Python FastAPI PostgreSQL") === "swe"
);
check(
  "Associate Software Engineer is SWE, not consulting",
  detectRoleFamily("Associate Software Engineer", "Boston Consulting Group", "") === "swe"
);
check("Excel is a claimable analyst tool", isTechTerm("excel"));
check("PowerPoint is a claimable analyst tool", isTechTerm("powerpoint"));
check("bare 'word' is not a skill term", !isTechTerm("word"));
check(
  "empty consulting JD still gets Professional skills",
  softSkillsFor("", "consulting").includes("Stakeholder Communication")
);
check(
  "empty analyst JD still gets Professional skills",
  softSkillsFor("", "analyst").includes("Analytical Thinking")
);
check("SWE JD without those words gets no forced consulting skills", softSkillsFor("Python FastAPI PostgreSQL").length === 0);

const masterish = [
  { company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform", title: "Software Engineer Intern (Academic WIL)" },
  { company: "Seneca Polytechnic — ITS", title: "Student HyFlex Ambassador + Lab Monitor (Co-op)" },
  { company: "Project Human City", title: "Software Engineer (Co-op)" },
  { company: "Seneca Polytechnic — Student Services", title: "Student Office Assistant & Peer Mentor" },
  { company: "Three of Cups", title: "Software Engineer (Freelance)" },
];
check("ITS is campus-ops", isCampusOpsEntry(masterish[1]));
check("office assistant is campus-ops", isCampusOpsEntry(masterish[3]));
check("INNWIL is not campus-ops", !isCampusOpsEntry(masterish[0]));
check("analyst keeps campus-ops entries", keepCampusOps("analyst") && selectExperienceEntries(masterish, "analyst").length === 5);
check("SWE drops campus-ops entries", selectExperienceEntries(masterish, "swe").length === 3);
check("analyst resumes drop a project to make room", projectSlots(5, { business: true }) === 2);

console.log(failures === 0 ? "\nall role-family checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
