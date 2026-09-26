/**
 * Deterministic checks for the structured JD analysis (section parsing +
 * heuristic labels). No LLM, no database, no cost.
 * Run: npx tsx scripts/test-jd-analysis.ts
 */
import { splitJdSections, heuristicAnalysis } from "../lib/tailor/jd-analysis";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

console.log("1) requirements / nice-to-have sections split must from nice");
const JD_SECTIONED = `About the team
We build payments infrastructure for small businesses across Canada.

What you'll do
- Design and ship REST services that move money between ledgers
- Review pull requests and keep the deploy pipeline healthy

Requirements
- Strong Python and SQL
- Experience with PostgreSQL and Docker
- Knowledge of CI/CD pipelines

Nice to have
- Exposure to Kubernetes
- Familiarity with Terraform

What we offer
- Competitive salary, stock options, and full benefits
`;
const sections = splitJdSections(JD_SECTIONED);
check("explicit requirements section detected", sections.hasExplicitMust);
check("must section holds Python/PostgreSQL", /python/i.test(sections.must) && /postgresql/i.test(sections.must));
check("nice section holds Kubernetes", /kubernetes/i.test(sections.nice) && !/python/i.test(sections.nice));
check("benefits tail is ignored", /stock options/i.test(sections.ignored) && !/stock options/i.test(sections.body));

const analysis = heuristicAnalysis(JD_SECTIONED, "Backend Software Developer", "Acme Payments");
check("python is a must-have", analysis.mustHaves.includes("python"), analysis.mustHaves.join(", "));
check("postgresql is a must-have", analysis.mustHaves.includes("postgresql"), analysis.mustHaves.join(", "));
check("kubernetes is a nice-to-have, not a must-have", analysis.niceToHaves.includes("kubernetes") && !analysis.mustHaves.includes("kubernetes"), `must=${analysis.mustHaves.join(", ")} nice=${analysis.niceToHaves.join(", ")}`);
check("body-only terms (rest) do not crowd the must list", analysis.mustHaves.filter((t) => t === "restapi").length <= 1);

console.log("\n2) headerless JD falls back to top global terms, with no nice-to-haves");
const JD_FLAT = `We are looking for a software developer to join our Toronto team. You will build React frontends and Node services. React and TypeScript are central to everything we do. TypeScript TypeScript React React.`;
const flat = heuristicAnalysis(JD_FLAT, "Software Developer", "SomeStartup");
check("top claimable terms become must-haves", flat.mustHaves.includes("react") && flat.mustHaves.includes("typescript"), flat.mustHaves.join(", "));
check("no invented nice-to-haves without a preferred section", flat.niceToHaves.length === 0, flat.niceToHaves.join(", "));

console.log("\n3) bullet-prefixed and bolded headers still classify");
const JD_BULLETS = `Who we are
A fintech scale-up.

- **Basic qualifications:**
- 3+ years of Python experience
- SQL and PostgreSQL

- **Preferred qualifications:**
- Go exposure
`;
const bulleted = splitJdSections(JD_BULLETS);
check("bulleted bold requirements header found", bulleted.hasExplicitMust, `must="${bulleted.must.slice(0, 60)}"`);
check("bulleted preferred section separated", /go exposure/i.test(bulleted.nice));

console.log("\n4) seniority signals come from title and years, not vibes");
check("5+ years reads senior", heuristicAnalysis("Requirements\n- 5+ years of backend experience with Python and SQL.", "Software Engineer", "Acme").seniority === "senior");
check("2 years reads junior", heuristicAnalysis("Requirements\n- 2 years of experience with Python and SQL.", "Software Engineer", "Acme").seniority === "junior");
check("new grad title reads junior", heuristicAnalysis("Join our team.", "New Grad Software Engineer", "Acme").seniority === "junior");
check("senior title reads senior", heuristicAnalysis("Join our team.", "Senior Software Engineer", "Acme").seniority === "senior");

console.log("\n5) business postings never demand never-invent vendors as must-haves");
const JD_IBM = `Your role and responsibilities
Learn HR Technology Platforms such as SAP SuccessFactors.
Participate in workshops with clients and document technical integration requirements.
Required: Java Script or Python, Knowledge of developing or working with APIs.
`;
const ibm = heuristicAnalysis(JD_IBM, "HR Technology Developer Associate", "IBM");
check("successfactors is not a must-have", !ibm.mustHaves.some((t) => /successfactors/i.test(t)), ibm.mustHaves.join(", "));
check("two-word 'Java Script' does not demand java", !ibm.mustHaves.includes("java"), ibm.mustHaves.join(", "));
check("python is still a must-have", ibm.mustHaves.includes("python"), ibm.mustHaves.join(", "));

console.log(failures === 0 ? "\nall jd-analysis checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
