/**
 * Deterministic checks for the Top-10 tailor upgrades:
 * sub-specialty craft, title hints, Skills homing/casing, ATS match parity,
 * project stub checks, first-bullet skim, and cover-letter audit.
 * Run: npx tsx scripts/test-domain-craft.ts
 */
import { detectRoleFamily } from "../lib/tailor/role-family";
import { detectSubSpecialty, craftBriefFor, recommendedTitleHint } from "../lib/tailor/domain-craft";
import { displayTech, jdTechHome } from "../lib/tailor/metric-guidance";
import { claimableJdTerms, matchScore, uncoveredTerms } from "../lib/tailor/match";
import { skillsPlainText } from "../lib/tailor/latex";
import {
  auditCoverLetter,
  auditExperienceBullets,
  auditProjectBullets,
  highSeverityCount,
  sanitizeCoverLetter,
} from "../lib/tailor/bullet-quality";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

console.log("1) role family + sub-specialty detection");
check(
  "Artificial Intelligence Engineer routes to data-ml (not generic swe)",
  detectRoleFamily("Artificial Intelligence Engineer", "Enterprise Solutions", "LLM RAG Python PyTorch") === "data-ml"
);
check(
  "AI Engineer sub-specialty is ai-ml-rag",
  detectSubSpecialty("Artificial Intelligence Engineer", "LLM RAG Python", "data-ml") === "ai-ml-rag"
);
check(
  "Security Engineer sub-specialty is security-appsec",
  detectSubSpecialty("Application Security Engineer", "OWASP CSRF RBAC rate limiting", "swe") === "security-appsec"
);
check(
  "Frontend Developer sub-specialty is frontend-ui",
  detectSubSpecialty("Frontend Software Developer", "React TypeScript CSS accessibility", "swe") === "frontend-ui"
);
check(
  "Supply Chain Analyst sub-specialty is supply-ops-analyst",
  detectSubSpecialty("Analyst, Supply Chain", "inventory fulfillment lead-time SQL Excel", "analyst") === "supply-ops-analyst"
);
check(
  "C++ Systems role sub-specialty is systems-cpp",
  detectSubSpecialty("Embedded Systems Engineer (C++)", "C++ Linux multithreading memory", "swe") === "systems-cpp"
);
check(
  "craft brief and title hint adapt to specialty",
  /golden eval|chunking/i.test(craftBriefFor("ai-ml-rag", "data-ml")) &&
    /AI \/ ML Software Engineer Intern/i.test(
      recommendedTitleHint({ sub: "ai-ml-rag", family: "data-ml", hybrid: false, wantsProgramming: true, flavor: "default" })
    )
);

console.log("\n2) Skills homing + displayTech proper casing");
check("cicd homes to Infra & Tools (not Cloud & Data)", jdTechHome("cicd") === "Infra & Tools");
check("copilot homes to Infra & Tools (not Languages)", jdTechHome("copilot") === "Infra & Tools");
check("googlecloud displayTech -> Google Cloud", displayTech("googlecloud") === "Google Cloud");
check("restapi displayTech -> REST APIs", displayTech("restapi") === "REST APIs");
check("springboot displayTech -> Spring Boot", displayTech("springboot") === "Spring Boot");
check("copilot displayTech -> GitHub Copilot", displayTech("copilot") === "GitHub Copilot");

console.log("\n3) ATS match.ts fixes: C\\#, marketing fluff, IMPLIES");
const JD_DELOITTE_FLUFF =
  "Frontier engineering and modern development with solution design. Must know Python, Docker, GitHub Actions, and C#.";
const fluffTerms = claimableJdTerms(JD_DELOITTE_FLUFF, 30, ["deloitte"], "Junior Software Engineer");
check("drops frontier engineering / modern development / solution design", !fluffTerms.some((t) => /frontier|modern|solution/.test(t)), fluffTerms.join(", "));
check("drops bare prose 'embedding' from tech lexicon", !claimableJdTerms("Embedding modern development across teams.", 20).includes("embedding"));

const RESUME_CSHARP = String.raw`\section{Skills}
\begin{itemize}\item \textbf{Languages}{: C\#, Python \\} \item \textbf{Infra \& Tools}{: Docker, GitHub Actions \\}\end{itemize}
\section{Experience}\resumeItem{Built C\# validation checks and Docker CI workflows in GitHub Actions.}`;
check(
  "escaped C\\# in LaTeX matches C# and GitHub Actions covers CI/CD",
  uncoveredTerms(["c#", "cicd", "containerization"], RESUME_CSHARP).length === 0,
  uncoveredTerms(["c#", "cicd", "containerization"], RESUME_CSHARP).join(", ")
);
check(
  "skillsPlainText reads ONLY Skills section (ignores URLs/Experience)",
  skillsPlainText(RESUME_CSHARP).includes("c#") && !skillsPlainText(RESUME_CSHARP).includes("validation checks")
);
check(
  "matchScore credits C# + Docker + GitHub Actions cleanly",
  (matchScore("Requirements: C#, CI/CD, containerization.", RESUME_CSHARP) ?? 0) === 100
);

console.log("\n4) Bullet quality: sub-specialty mechanisms, AI slop, project stub, first-bullet skim");
const secEntry = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Application Security / Software Engineer Intern (Co-op)",
      bullets: [
        "Hardened 4 review endpoints with httpOnly session cookies and CSRF checks so forged requests could not alter records.",
        "Added ownership-scoped SQL validation after a review uncovered cross-tenant reads, closing 6 security defect tickets before release.",
        "Walked senior reviewers through the rate-limiting checklist and abuse cases during our sprint handoff review.",
      ],
    },
  ],
  { expandedCount: 1, topMustHaves: ["csrf", "sql"] }
);
check("AppSec bullet mechanisms + first-bullet skim pass cleanly", highSeverityCount(secEntry) === 0, secEntry.map((i) => i.message).join(" | "));

const slopAndSkim = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Streamlined cutting-edge backend jobs across 3 environments so internal partners shipped faster.",
        "Fixed 4 slow queries in PostgreSQL by filtering records before joins, cutting report wait time.",
        "Walked teammates through updated runbook steps at weekly sprint review.",
      ],
    },
  ],
  { expandedCount: 1, topMustHaves: ["graphql", "kubernetes"] }
);
check("AI slop ('Streamlined', 'cutting-edge') is high severity", slopAndSkim.some((i) => i.severity === "high" && /AI-tell/.test(i.message)));
check("missing first-bullet skim is high severity", slopAndSkim.some((i) => i.severity === "high" && /7 second recruiter scan/.test(i.message)));

const shortProj = auditProjectBullets([
  {
    id: "bettermind",
    bullets: [
      "Mental wellness app that scores daily journal entries and surfaces mood patterns for users.",
      "Built Next.js app with PostgreSQL.",
    ],
  },
]);
check("6-word project stub is high severity", shortProj.some((i) => i.severity === "high" && /only 5 words|stub/.test(i.message)));

console.log("\n5) Cover letter sanitize + audit");
const cleaned = sanitizeCoverLetter(["I utilized FastAPI — in order to speed up jobs."]);
check("sanitizeCoverLetter strips em-dash + 'utilize' + 'in order to'", cleaned[0] === "I used FastAPI - to speed up jobs.", cleaned[0]);
const badCover = auditCoverLetter(["When I read about Acme, it caught my attention immediately."], "Backend Engineer");
check("auditCoverLetter flags 'caught my attention' and missing role", badCover.length === 2, badCover.join(" | "));

console.log(failures === 0 ? "\nall domain-craft checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
