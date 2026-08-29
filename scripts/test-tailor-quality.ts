/**
 * Deterministic quality gates for tailoring v4:
 *  - polishBullet: vague tails cut, self-praise adjectives stripped, no false positives
 *  - claimableJdTerms: JD attitude/marketing words never reach score/boost/targeting
 *  - matchScore: fluff-free resume isn't dragged down by unclaimable JD prose
 *  - assembleSkillsSection: items are re-homed to their canonical label
 *
 * No LLM calls. Run: npx tsx scripts/test-tailor-quality.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { polishBullet } from "../lib/tailor/generate";
import { claimableJdTerms, isClaimableTerm, isTechTerm, matchScore } from "../lib/tailor/match";
import { normalizeForTectonic, parseSkillsSection, assembleSkillsSection } from "../lib/tailor/latex";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    console.log(`FAIL ${name}${detail ? `\n  ${detail}` : ""}`);
    failed++;
  } else {
    console.log(`ok  ${name}`);
  }
}

// ---------- polishBullet ----------
check(
  "vague tail cut (giving)",
  polishBullet("Added GitHub Actions CI/CD gates with tests and code review checks, giving a dedicated release path for API changes.") ===
    "Added GitHub Actions CI/CD gates with tests and code review checks."
);
check(
  "vague tail cut (keeping)",
  polishBullet("Shipped Kotlin Android and React features against shared REST APIs, keeping authentication flows consistent across clients.") ===
    "Shipped Kotlin Android and React features against shared REST APIs."
);
check(
  "vague tail cut (so the)",
  polishBullet("Built Python FastAPI services, decoupling heavy extraction from client paths so the APIs stayed responsive under load.") ===
    "Built Python FastAPI services, decoupling heavy extraction from client paths."
);
check(
  "self-praise stripped (maintainable)",
  polishBullet("Built maintainable FastAPI services for web application workflows.") === "Built FastAPI services for web application workflows."
);
check(
  "self-praise stripped (analytical)",
  polishBullet("Fixed backend defects using analytical debugging on SQL queries.") === "Fixed backend defects using debugging on SQL queries."
);
check(
  "artifact ending kept (no false positive)",
  polishBullet("Designed normalized PostgreSQL schemas and inspected execution plans to remove slow SQL paths.") ===
    "Designed normalized PostgreSQL schemas and inspected execution plans to remove slow SQL paths."
);
check(
  "verified number untouched",
  polishBullet("Designed a 13-table Prisma/PostgreSQL schema with composite UNIQUE constraints.") ===
    "Designed a 13-table Prisma/PostgreSQL schema with composite UNIQUE constraints."
);
check(
  "dangling connector after tail cut",
  polishBullet("Built Python FastAPI services for VYBE, moving CPU-heavy extraction off the request path and keeping the APIs responsive under load.") ===
    "Built Python FastAPI services for VYBE, moving CPU-heavy extraction off the request path."
);
check(
  "snake_case identifier de-coded",
  polishBullet("Diagnosed backend defects, tracing webhook retries through logs and the external_payloads table.") ===
    "Diagnosed backend defects, tracing webhook retries through logs and the external payloads table."
);
check("skills: 'event driven' is not a tech term", !isTechTerm("event driven"));
check("skills: 'event streaming' stays a tech term", isTechTerm("event streaming"));
check("skills: 'data pipelines' stays a tech term", isTechTerm("data pipelines"));

// ---------- claimable JD terms ----------
// Real JDs repeat their requirements; bigrams only count at f>=2 by design,
// so this fixture repeats the technical requirements the way real postings do.
const FLUFFY_JD = `We are a next generation consultancy. Our employees enjoy a culture of innovation and we hire
exceptionally smart, curious, driven people who are lifelong learners. BMO Financial Group values forward thinking.
Pay type and salary vary based on location.
The role: build REST APIs and data pipelines in Python; you will ship REST APIs used by millions.
We practice code review daily, and code review gates every merge. Strong CI/CD practices, CI/CD for every service.
PostgreSQL query optimization and PostgreSQL schema design. Computer Science degree or Computer Science fundamentals.
Experience with Kubernetes and machine learning a plus; Kubernetes runs our platform and machine learning powers it.`;

const claimable = claimableJdTerms(FLUFFY_JD, 40, ["bmo"]);
for (const banned of ["excited", "curious", "driven", "forward thinking", "lifelong learner", "financial group", "pay type", "consultancy", "smart"]) {
  check(`claimable excludes "${banned}"`, !claimable.includes(banned), `got: ${claimable.join(", ")}`);
}
for (const want of ["restapi", "postgresql", "cicd", "code review", "computer science", "python", "kubernetes", "machinelearning"]) {
  check(`claimable keeps "${want}"`, claimable.includes(want), `got: ${claimable.join(", ")}`);
}
check("claimable: code review", isClaimableTerm("code review"));
check("claimable: computer science", isClaimableTerm("computer science"));
check("not claimable: excited", !isClaimableTerm("excited"));
check("not claimable: satellite (domain noun)", !isClaimableTerm("satellite"));
check("not claimable: lone prose word", !isClaimableTerm("looking"));

// ---------- matchScore honesty ----------
const resumeTex = "Built Python REST APIs and data pipelines. CI/CD with code review gates. PostgreSQL query optimization. Computer Science coursework.";
const score = matchScore(FLUFFY_JD, resumeTex, "BMO");
check("fluff-free resume scores >=70 against claimable terms", score !== null && score >= 70, `score=${score}`);

// ---------- skills canonical labels ----------
const masterTex = normalizeForTectonic(readFileSync(path.join(process.cwd(), "..", "Resume.tex"), "utf8"));
const section = parseSkillsSection(masterTex);
const line = (tex: string, label: string) => tex.split("\n").find((l) => l.includes(label)) ?? "";

// model mislabels on purpose: Agile/Scrum under Languages, Java under Frameworks
const regrouped = assembleSkillsSection(section, [
  { label: "Languages", items: ["Python", "Agile/Scrum", "React"] },
  { label: "Frameworks", items: ["Java", "FastAPI"] },
]);
check(
  "mislabeled Agile/Scrum re-homed to Infra & Tools",
  !line(regrouped, "Languages").includes("Agile") && line(regrouped, "Infra \\& Tools").includes("Agile/Scrum"),
  regrouped
);
check(
  "mislabeled React re-homed to Frameworks",
  !line(regrouped, "Languages").includes("React") && line(regrouped, "Frameworks").includes("React"),
  regrouped
);
check(
  "Java lands under Languages",
  line(regrouped, "Languages").includes("Java") && !line(regrouped, "Frameworks").includes("Java"),
  regrouped
);
check(
  "master label rename present (Infra & Tools)",
  line(regrouped, "Infra \\& Tools").length > 0 && !regrouped.includes("ML \\& Infra"),
  regrouped
);
check(
  "Machine Learning lives under Cloud & Data",
  line(regrouped, "Cloud \\& Data").includes("Machine Learning"),
  regrouped
);
// JD-allowed extra with no canonical home stays where the model put it
const withExtra = assembleSkillsSection(section, [{ label: "Cloud & Data", items: ["PostgreSQL", "Kubernetes"] }], 0, [], ["Kubernetes"]);
check("JD extra (no home) stays on chosen line", line(withExtra, "Cloud \\& Data").includes("Kubernetes"), withExtra);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall good");
