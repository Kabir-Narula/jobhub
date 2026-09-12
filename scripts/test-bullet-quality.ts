/**
 * Regression tests for the bullet doctrine auditor. No LLM, no DB, no cost.
 * Usage: npx tsx scripts/test-bullet-quality.ts
 *
 * The "before" fixtures are the REAL bullets a live run produced for the
 * Capgemini Gen AI posting — they are technically dense and humanly empty, which
 * is exactly the failure the auditor exists to catch.
 */
import {
  auditExperienceBullets,
  highSeverityCount,
  bannedNumberShapes,
} from "../lib/tailor/bullet-quality";
import { polishBullet } from "../lib/tailor/generate";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const messages = (issues: { message: string }[]) => issues.map((i) => i.message).join(" | ");

// ---------------------------------------------------------------- before/after
const BEFORE = [
  {
    company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
    bullets: [
      "Built Python FastAPI services for retrieval-augmented extraction, separating compute-heavy processing from client requests through a background job queue.",
      "Prototyped PyTorch inference inside the extraction service, adding tensor preprocessing tests and model response contracts to the CI/CD gate.",
      "Wired LangChain prompt chains into an internal extraction endpoint, documenting fallback behavior and review criteria in a Confluence runbook.",
    ],
  },
];

const AFTER = [
  {
    company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
    bullets: [
      "Moved document extraction off the FastAPI request path into a background worker after large uploads began timing out, cutting waits from about 40 seconds to under 5.",
      "Traced a batch of empty extraction results to a PDF parser dropping scanned pages, then added a fixture-based test for the case.",
      "Walked the research lead through the new LangChain fallback behaviour at sprint review, then wrote the runbook the next intern used.",
    ],
  },
];

const beforeIssues = auditExperienceBullets(BEFORE, { expandedCount: 1 });
check(
  "real generated bullets are flagged for stating no result",
  beforeIssues.some((i) => /states what changed/.test(i.message)),
  messages(beforeIssues)
);
check(
  "real generated bullets are flagged for being all greenfield building",
  beforeIssues.some((i) => /greenfield/.test(i.message)),
  messages(beforeIssues)
);
check(
  "identical verb-plus-gerund rhythm is flagged",
  beforeIssues.some((i) => /same "verb\.\.\., -ing clause" skeleton/.test(i.message)),
  messages(beforeIssues)
);

const afterIssues = auditExperienceBullets(AFTER, { expandedCount: 1 });
check(
  "rewritten bullets pass every high-severity check",
  highSeverityCount(afterIssues) === 0,
  messages(afterIssues.filter((i) => i.severity === "high"))
);

// ---------------------------------------------------------------- number shapes
const BANNED = [
  "Optimized the reporting query and improved response time by 47% across the dashboard.",
  "Made the ingestion pipeline 3x faster by batching the upserts into a single transaction.",
  "Built an export endpoint serving 40,000 users on the customer portal each month.",
  "Kept the payments service at 99.9% uptime through the migration to the new queue.",
  "Shipped a billing screen that recovered $2M in annual recurring revenue for the team.",
];
for (const b of BANNED) {
  check(`banned number shape caught: "${b.slice(0, 40)}..."`, bannedNumberShapes([b]).length > 0);
}

const ALLOWED = [
  "Cut the nightly export from about 40 minutes to under 5 by batching the writes into one transaction.",
  "Added roughly 40 test cases around the parser after a scanned-page bug reached the release branch.",
  "Split the ingest job across three services with the senior engineer during sprint planning, then documented the handoff.",
];
for (const b of ALLOWED) {
  check(`defensible number allowed: "${b.slice(0, 40)}..."`, bannedNumberShapes([b]).length === 0, bannedNumberShapes([b]).join(","));
}

// ---------------------------------------------------------------- per-bullet checks
const single = (bullets: string[]) => auditExperienceBullets([{ company: "X", bullets }], { expandedCount: 0 });

check(
  "keyword-list bullet flagged for naming too many technologies",
  single(["Used Python, FastAPI, PostgreSQL, Redis and Docker to build the ingestion endpoint for the team."]).some((i) =>
    /names \d+ technologies/.test(i.message)
  )
);
check(
  "filler flagged",
  single(["Worked on various backend tasks and helped with the deployment pipeline for the release."]).some((i) =>
    /filler/.test(i.message)
  )
);
check(
  "inflated scope flagged",
  single(["Architected the event-driven ingestion platform from the ground up for the analytics team."]).some((i) =>
    /senior scope/.test(i.message)
  )
);
check(
  "bullet with no concrete artifact flagged",
  single(["Improved cross-functional alignment and delivery velocity across the wider engineering organisation."]).some((i) =>
    /no concrete artifact/.test(i.message)
  )
);
check(
  "unfalsifiable ending flagged",
  single(["Refactored the ingestion module into smaller handlers, ensuring the service stayed reliable under load."]).some(
    (i) => /unfalsifiable/.test(i.message)
  )
);

// ---------------------------------------------------------------- polishBullet
// The old polish cut every tail on its connector, which deleted the outcome the
// new doctrine requires. Fluff must still go; real state changes must survive.
const kept = polishBullet(
  "Batched the nightly writes into one transaction, cutting the export from 40 minutes to under 5."
);
check("concrete result clause survives polish", /40 minutes to under 5/.test(kept), kept);

const keptQualitative = polishBullet(
  "Added a retry with backoff around the partner feed, so the nightly reconciliation stopped failing on partial files."
);
check(
  "qualitative state change survives polish",
  /stopped failing on partial files/.test(keptQualitative),
  keptQualitative
);

const stripped = polishBullet(
  "Moved the extraction job onto a background worker, keeping the platform APIs responsive."
);
check("unfalsifiable tail is still stripped", !/responsive/.test(stripped), stripped);

const strippedPraise = polishBullet("Split the service into smaller, maintainable modules with tests in CI.");
check("self-praise adjective still removed", !/maintainable/.test(strippedPraise), strippedPraise);

console.log(failures === 0 ? "all bullet-quality checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
