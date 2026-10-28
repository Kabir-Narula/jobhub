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
  auditProjectBullets,
  highSeverityCount,
  bannedNumberShapes,
} from "../lib/tailor/bullet-quality";
import { polishBullet, alignByCompany, keepTitleQualifier, clampConsultingTitle, finalizeBusinessTitle } from "../lib/tailor/generate";
import { pinBusinessSkills } from "../lib/tailor/latex";

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
      "Traced 8 empty extraction results to a PDF parser dropping scanned pages, then added a fixture-based test for the case.",
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

// --------------------------------------- depth / magnitude / repetition checks
// Fixtures are the real weak spots from the shipped TD resume.
const TD = [
  {
    company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
    bullets: [
      "Moved extraction and cleaning into a Python FastAPI pipeline after concurrent large data requests timed out; clients stopped seeing timeout errors.",
      "Cut a slow SQL report by filtering before joins and adding a composite index after analysts waited on repeated exports.",
      "Paired with a senior engineer to test a Spark transformation in GitHub Actions, then documented failed-record handling for business partners.",
    ],
  },
  {
    company: "Three of Cups",
    bullets: [
      "Modeled normalized PostgreSQL schemas for shared request workloads.",
      "Inspected SQL execution plans and removed slow query paths that had delayed responses across the client's shared request workloads.",
      "Moved synchronous backend work into asynchronous background jobs, preventing request timeouts and separating long-running processing from client-facing paths.",
    ],
  },
];
const tdIssues = auditExperienceBullets(TD, { expandedCount: 1 });
check(
  "Spark named with no technique and no outcome is flagged",
  tdIssues.some((i) => /name-drops/.test(i.message) && /spark/i.test(i.message)),
  messages(tdIssues)
);
check(
  "a resume with no number anywhere is flagged",
  tdIssues.some((i) => /not one bullet on the resume carries a number/.test(i.message)),
  messages(tdIssues)
);
check(
  "the 8-word stub is high severity, not cosmetic",
  tdIssues.some((i) => i.severity === "high" && /only 8 words/.test(i.message)),
  messages(tdIssues)
);
check(
  'the verbatim repeat "shared request workloads" is flagged',
  tdIssues.some((i) => /reused verbatim/.test(i.message) && /shared request workloads/.test(i.message)),
  messages(tdIssues)
);
check(
  "a bullet with a real technique is NOT flagged as a name-drop",
  !tdIssues.some((i) => /name-drops/.test(i.message) && /composite index/.test(i.message))
);

// A magnitude anywhere satisfies the resume-wide rule.
const quantified = auditExperienceBullets(
  [
    {
      company: "A",
      bullets: [
        "Cut the nightly PostgreSQL export from about 40 minutes to under 5 by batching the writes into one transaction.",
        "Traced duplicate totals across 4 source files to a fan-out join, corrected the grouping key, and stopped inflated figures reaching the report.",
        "Paired with a senior engineer on the migration, then documented the backfill steps in the runbook the team used.",
      ],
    },
  ],
  { expandedCount: 1 }
);
check(
  "a quantified resume passes the magnitude rule",
  !quantified.some((i) => /carries a number/.test(i.message)),
  messages(quantified)
);
check("the quantified sample has no high-severity issues", highSeverityCount(quantified) === 0, messages(quantified.filter((i) => i.severity === "high")));

const stuffed = auditExperienceBullets(
  [
    {
      company: "Lab",
      bullets: [
        "Moved extraction off the FastAPI request path into a worker after large uploads timed out, cutting waits from 40 seconds to under 5.",
        "Added FastAPI fixtures around the extraction endpoint after code review caught inconsistent payloads.",
        "Walked the research lead through the FastAPI fallback at sprint review, then wrote the runbook.",
      ],
    },
  ],
  { expandedCount: 1 }
);
check(
  "FastAPI in three bullets is flagged as brand stuffing",
  stuffed.some((i) => /fastapi/i.test(i.message) && /experience bullets/.test(i.message)),
  messages(stuffed)
);
const once = auditExperienceBullets(
  [
    {
      company: "Lab",
      bullets: [
        "Moved extraction off the FastAPI request path into a worker after large uploads timed out, cutting waits from 40 seconds to under 5.",
        "Traced 6 empty results to a parser dropping scanned pages, then added a fixture-based test for the case.",
        "Walked the research lead through the new export format at sprint review, then wrote the runbook.",
      ],
    },
  ],
  { expandedCount: 1 }
);
check(
  "a single FastAPI mention is allowed",
  !once.some((i) => /fastapi/i.test(i.message) && /experience bullets/.test(i.message)),
  messages(once)
);

// ------------------------------------------------- entry alignment (real bug)
// A live TD run returned the entries in a different order, so Project Human
// City's REST/mobile work was assembled under Three of Cups and vice versa.
const COMPANIES = ["Seneca Polytechnic — INNWIL Lab | VYBE Platform", "Project Human City", "Three of Cups"];
const reordered = [
  { company: "Three of Cups", bullets: ["freelance work"] },
  { company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform", bullets: ["lab work"] },
  { company: "Project Human City", bullets: ["co-op work"] },
];
const realigned = alignByCompany(COMPANIES, reordered);
check("reordered entries are realigned to the right company", realigned[0]?.bullets[0] === "lab work", String(realigned[0]?.bullets[0]));
check("co-op work lands on the co-op employer", realigned[1]?.bullets[0] === "co-op work", String(realigned[1]?.bullets[0]));
check("freelance work lands on the freelance client", realigned[2]?.bullets[0] === "freelance work", String(realigned[2]?.bullets[0]));

// A shortened employer name must still match.
const shortened = alignByCompany(COMPANIES, [
  { company: "Project Human City", bullets: ["co-op"] },
  { company: "Seneca Polytechnic", bullets: ["lab"] },
  { company: "Three of Cups", bullets: ["freelance"] },
]);
check("shortened employer name still matches", shortened[0]?.bullets[0] === "lab", String(shortened[0]?.bullets[0]));

// No company field at all -> original positions, i.e. previous behaviour.
const noNames = alignByCompany(COMPANIES, [{ bullets: ["a"] }, { bullets: ["b"] }, { bullets: ["c"] }] as never);
check("missing company falls back to index order", noNames.map((g) => (g as { bullets: string[] })?.bullets[0]).join("") === "abc");

// ------------------------------------------------- title qualifier (real bug)
check(
  "a co-op cannot be relabelled freelance",
  keepTitleQualifier("Software Engineer (Co-op)", "Data Engineering Developer (Freelance)") ===
    "Data Engineering Developer (Co-op)",
  keepTitleQualifier("Software Engineer (Co-op)", "Data Engineering Developer (Freelance)")
);
check(
  "matching qualifier is left alone",
  keepTitleQualifier("Software Engineer Intern (Academic WIL)", "Data Engineering Intern (Academic WIL)") ===
    "Data Engineering Intern (Academic WIL)"
);
check(
  "a dropped qualifier is restored",
  keepTitleQualifier("Software Engineer (Freelance)", "Backend Data Developer") === "Backend Data Developer (Freelance)",
  keepTitleQualifier("Software Engineer (Freelance)", "Backend Data Developer")
);
check(
  "titles with no qualifier are untouched",
  keepTitleQualifier("Software Engineer", "Data Engineer") === "Data Engineer"
);
check(
  "Academic WIL is rewritten to Co-op",
  clampConsultingTitle("Software Engineer Intern (Academic WIL)", "Business Analyst Intern (Academic WIL)") ===
    "Business Analyst Intern (Co-op)"
);
check(
  "consulting titles keep the co-op marker",
  clampConsultingTitle("Software Engineer (Co-op)", "Business Analyst") === "Business Analyst (Co-op)"
);
check(
  "Consultant is rewritten to Analyst",
  clampConsultingTitle("Software Engineer (Co-op)", "Management Consultant (Co-op)") === "Business Analyst (Co-op)",
  clampConsultingTitle("Software Engineer (Co-op)", "Management Consultant (Co-op)")
);
check(
  "Senior is not invented on a co-op title",
  clampConsultingTitle("Software Engineer (Co-op)", "Senior Business Analyst (Co-op)") === "Software Engineer (Co-op)"
);
check(
  "CS bridge keeps an engineer title when the model proposes Data Automation Engineer",
  finalizeBusinessTitle("Software Engineer Intern (Co-op)", "Data Automation Engineer (Co-op)", true) ===
    "Data Automation Engineer (Co-op)"
);
check(
  "CS bridge restores original engineer title if the model over-corrects to Business Analyst",
  finalizeBusinessTitle("Software Engineer Intern (Co-op)", "Business Analyst (Co-op)", true) ===
    "Software Engineer Intern (Co-op)"
);
check(
  "non-bridge software row is forced to Business Analyst",
  finalizeBusinessTitle("Software Engineer (Co-op)", "Software Engineer (Co-op)", false) === "Business Analyst (Co-op)"
);

const bridgeBalanced = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Built a Python refresh that joined 3 incomplete source files so the weekly occupancy SQL stayed trustworthy.",
        "Found occupancy mismatches across 4 sites, synthesized the gap into a short brief, and the ops lead used it to set follow-ups.",
        "Walked stakeholders through the occupancy recommendation so the Friday chase on late files stopped for good.",
      ],
    },
    {
      company: "Project Human City",
      title: "Business Analyst (Co-op)",
      bullets: [
        "Found a mismatch in the weekly report file, reconciled the source in Excel, and the report went out without a chase.",
        "Sized the variance across 4 sites after the Friday file kept arriving late, then documented the gap.",
        "Walked the ops lead through 2 occupancy recommendations so they stopped chasing the weekly spreadsheet each Friday.",
      ],
    },
  ],
  { expandedCount: 2, family: "consulting" }
);
check(
  "balanced CS bridge with one engineer title passes consulting audit",
  highSeverityCount(bridgeBalanced) === 0,
  messages(bridgeBalanced.filter((i) => i.severity === "high"))
);
const bridgeMissing = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Business Analyst (Co-op)",
      bullets: [
        "Found a mismatch in 2 weekly occupancy files, reconciled the source in Excel, and the report went out without a chase.",
        "Built an Excel occupancy model after the Friday file kept arriving late, then sized the gap across 3 sites.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the weekly spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "all-Analyst titles with no CS bridge is high severity",
  bridgeMissing.some((i) => i.severity === "high" && /CS bridge|engineer\/CS/i.test(i.message)),
  messages(bridgeMissing)
);

// --------------------------------------- conditional CS bridge (no-coding JD)
// A Bain-style strategy posting with no programming requirement gets ZERO
// engineering titles; an engineer title on it is the high-severity failure.
const BAIN_STYLE_JD = `What you'll do: work with client teams on their hardest problems, structure ambiguous questions, build fact-based recommendations, present to senior executives. What you'll bring: strong academic record, leadership, teamwork, communication.`;
const engineerOnNoCoding = auditExperienceBullets(
  [
    {
      company: "INNWIL",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Found a mismatch in the weekly report file, reconciled the source in Excel, and the report went out without a chase.",
        "Sized the variance across 4 sites after the Friday file kept arriving late, then documented the gap.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the weekly spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting", jobTitle: "Associate Consultant", jobDescription: BAIN_STYLE_JD }
);
check(
  "engineer title on a no-coding posting is high severity",
  engineerOnNoCoding.some((i) => i.severity === "high" && /no programming\/coding requirement/i.test(i.message)),
  messages(engineerOnNoCoding)
);
const analystOnNoCoding = auditExperienceBullets(
  [
    {
      company: "INNWIL",
      title: "Business Analyst (Co-op)",
      bullets: [
        "Found a mismatch in the weekly report file, reconciled the source in Excel, and the report went out without a chase.",
        "Sized the variance across 4 sites after the Friday file kept arriving late, then documented the gap.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the weekly spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting", jobTitle: "Associate Consultant", jobDescription: BAIN_STYLE_JD }
);
check(
  "all-Analyst page on a no-coding posting is not flagged for titles",
  !analystOnNoCoding.some((i) => /CS bridge|engineer\/CS|no programming/i.test(i.message)),
  messages(analystOnNoCoding)
);

// --------------------------------------- cover-letter company facts are exempt
// TD's research mentions a "$1,790 in value" package; quoting it in the cover
// letter is correct, and the money-figure ban must not apply outside the resume.
check(
  "money figure is still banned inside a resume bullet",
  bannedNumberShapes(["Shipped a billing screen that recovered $2M in revenue."]).length > 0
);

// ------------------------------------------------- project two-bullet doctrine
const BAD_PROJECTS = [
  {
    id: "bettermind",
    bullets: [
      "Added OpenAI API inference pipelines to a Next.js product, recording sentiment, confidence, and evidence for downstream analysis.",
      "Modeled a 13-table Prisma/PostgreSQL schema with composite unique constraints, turning inference outputs into durable records for weekly insight synthesis.",
    ],
  },
];
const badProj = auditProjectBullets(BAD_PROJECTS);
check(
  "implementation-as-summary is flagged on bullet 1",
  badProj.some((i) => /opens on implementation|never says what the product is/.test(i.message)),
  messages(badProj)
);

const GOOD_PROJECTS = [
  {
    id: "bettermind",
    bullets: [
      "Mental wellness app that scores daily journal entries and surfaces mood patterns so a companion chat can answer from the user's own history.",
      "Ran OpenAI sentiment scoring through a Prisma schema with composite unique constraints, storing confidence and evidence as durable inference records.",
    ],
  },
];
const goodProj = auditProjectBullets(GOOD_PROJECTS);
check(
  "purpose-then-implementation pair passes",
  highSeverityCount(goodProj) === 0,
  messages(goodProj)
);
check(
  "a one-bullet project is flagged",
  auditProjectBullets([{ id: "axom", bullets: ["Exam-prep app that turns slides into practice tests."] }]).some((i) =>
    /exactly 2/.test(i.message)
  )
);
check(
  "business JobHub tailored-resume copy is high",
  auditProjectBullets(
    [
      {
        id: "jobhub",
        bullets: [
          "Job-search platform that gathers postings and generates a tailored resume for every role.",
          "PostgreSQL stores every status change so the board stays reviewable.",
        ],
      },
    ],
    { family: "analyst" }
  ).some((i) => i.severity === "high" && /tailored resume/i.test(i.message))
);
check(
  "partner-questions-became fog is high on analyst pages",
  auditExperienceBullets(
    [
      {
        company: "INNWIL",
        bullets: [
          "Partner questions became reporting requirements and validation rules that reviewers used as acceptance criteria for each delivery.",
          "Automated extraction checks with Python across 3 service outputs so internal reporting no longer required manual review.",
          "Documented data-flow tradeoffs and handoff notes so technical and non-technical partners followed consistent field definitions.",
        ],
      },
    ],
    { family: "analyst", expandedCount: 1 }
  ).some((i) => i.severity === "high" && /vague evidence|shared reference|partner questions|field definitions/i.test(i.message))
);

const CONSULTING_ENTRY = [
  {
    company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
    bullets: [
      "Found a mismatch in 2 weekly occupancy files, reconciled the source in Excel, and the report went out without a chase.",
      "Built an Excel occupancy model after the Friday file kept arriving late, then sized the gap across 3 sites.",
      "Walked the ops lead through the occupancy recommendation so they stopped chasing the weekly spreadsheet each Friday.",
    ],
  },
  {
    company: "Project Human City",
    bullets: [
        "Compared 4 incomplete source files into one brief so the ops lead stopped reconciling by hand each Friday.",
        "Sized the variance after 5 late files arrived, then documented the gap for the next planning review.",
        "Walked stakeholders through the occupancy recommendation so the Friday chase on late files stopped for good.",
    ],
  },
];
const consultingIssues = auditExperienceBullets(CONSULTING_ENTRY, { expandedCount: 2, family: "consulting" });
check(
  "consulting CAR bullets pass the consulting auditor",
  highSeverityCount(consultingIssues) === 0,
  messages(consultingIssues.filter((i) => i.severity === "high"))
);
const leakIssues = auditExperienceBullets(
  [
    {
      company: "Project Human City",
      bullets: [
        "Compared authentication and error-handling flows across mobile and web clients, then recommended shared rules.",
        "Found a mismatch in weekly occupancy, reconciled it in Excel, and the report went out.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "authentication/error-handling on a consulting resume is a high-severity leak",
  leakIssues.some((i) => i.severity === "high" && /software-implementation/i.test(i.message)),
  messages(leakIssues)
);
const mobileLeak = auditExperienceBullets(
  [
    {
      company: "Project Human City",
      bullets: [
        "Compared third-party data across mobile and web clients, then standardized the shared outputs.",
        "Found a mismatch in weekly occupancy, reconciled it in Excel, and the report went out.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "mobile-and-web / third-party data on a consulting resume is a high-severity leak",
  mobileLeak.some((i) => i.severity === "high" && /software-implementation/i.test(i.message)),
  messages(mobileLeak)
);
const twoBulletStub = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      bullets: [
        "Found a mismatch in the weekly occupancy file, reconciled the source in Excel, and the report went out without a chase.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the weekly spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "a 2-bullet consulting entry is a high-severity stub",
  twoBulletStub.some((i) => i.severity === "high" && /3 CAR bullets/i.test(i.message)),
  messages(twoBulletStub)
);
const campusDup = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — ITS",
      bullets: [
        "Restored HyFlex audio and display for a professor after the camera dropped so class could start.",
        "Rewrote faculty notices in Word after instructors asked the same HyFlex setup questions each week.",
        "Traced repeat projector failures and showed faculty the recovery steps so they stopped waiting on ITS.",
      ],
    },
    {
      company: "Seneca Polytechnic — Student Services",
      bullets: [
        "Matched open request IDs with VLOOKUP after the paper log dropped follow-ups, and the desk stopped losing items.",
        "Mapped repeated student questions to process gaps and standardized faculty notices for the front desk.",
        "During advising, passed recurring onboarding concerns to campus staff so orientation notes were updated.",
      ],
    },
  ],
  { expandedCount: 2, family: "consulting" }
);
check(
  "reused faculty-notices copy across campus-ops jobs is high severity",
  campusDup.some((i) => i.severity === "high" && /faculty notices/i.test(i.message)),
  messages(campusDup)
);
const hyflexGood = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — ITS",
      bullets: [
        "Restored HyFlex audio and display for a professor in one of 30+ rooms after the camera dropped so class could start.",
        "Traced repeat lab login failures to a stale image, reimaged the station, and the next section ran on time.",
        "Showed faculty the projector recovery steps after the third restore so they could get the room back without waiting.",
      ],
    },
    {
      company: "Seneca Polytechnic — Student Services",
      bullets: [
        "Matched open request IDs in the tracker after 6 follow-ups were dropped, and the desk stopped losing items.",
        "Walked incoming students through onboarding in one-on-ones, then passed recurring concerns to campus staff.",
        "Found a mismatch in the weekly log, reconciled the source, and the report went out without a chase.",
      ],
    },
  ],
  { expandedCount: 2, family: "consulting" }
);
check(
  "HyFlex troubleshooting bullets pass without Excel/Word stamps",
  highSeverityCount(hyflexGood) === 0,
  messages(hyflexGood.filter((i) => i.severity === "high"))
);
const hyflexDocs = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — ITS",
      bullets: [
        "Tracked incidents across 30 HyFlex rooms in Excel, then escalated repeat equipment patterns to ITS staff.",
        "Rewrote faculty notices in Word after instructors asked the same HyFlex setup questions each week.",
        "Documented HyFlex procedures in Word so the support desk had a reusable guide.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "HyFlex documentation-only bullets are high severity",
  hyflexDocs.some((i) => i.severity === "high" && /documentation/i.test(i.message)),
  messages(hyflexDocs)
);
const excelStamp = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      bullets: [
        "Found a mismatch in the weekly occupancy file, reconciled the source in Excel, and the report went out.",
        "Built an Excel occupancy model after the Friday file kept arriving late, then sized the gap across 3 sites.",
        "Walked the ops lead through an Excel walkthrough so they stopped chasing the weekly spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "Excel stamped on 3+ bullets is high severity",
  excelStamp.some((i) => i.severity === "high" && /Excel\/Word\/PowerPoint is stamped/i.test(i.message)),
  messages(excelStamp)
);
const vlookupEntry = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — Student Services",
      bullets: [
        "Matched open request IDs with VLOOKUP after 6 follow-ups were dropped, and the desk stopped losing items.",
        "Walked incoming students through onboarding in one-on-ones, then passed recurring concerns to campus staff.",
        "Found a mismatch across 2 weekly logs, reconciled the source, and the report went out without a chase.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "a VLOOKUP tracker bullet counts as a consulting artifact without saying Excel",
  highSeverityCount(vlookupEntry) === 0,
  messages(vlookupEntry.filter((i) => i.severity === "high"))
);
const consultingAsSwe = auditExperienceBullets(CONSULTING_ENTRY, { expandedCount: 1 });
check(
  "the same CAR bullets fail the SWE mechanism quota",
  consultingAsSwe.some((i) => /mechanism|greenfield|artifact/i.test(i.message)),
  messages(consultingAsSwe)
);

const confluenceInvent = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      bullets: [
        "Compared infrastructure tradeoffs and summarized recommendations in Confluence for 2 partner teams.",
        "Found a mismatch in weekly occupancy, reconciled it in Excel, and the report went out.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "invented Confluence on a consulting resume is high severity",
  confluenceInvent.some((i) => i.severity === "high" && /confluence/i.test(i.message)),
  messages(confluenceInvent)
);

const vagueIntel = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      bullets: [
        "Built Python workflows that separated heavy extraction from live requests, giving partners repeatable intelligence inputs.",
        "Found a mismatch in weekly occupancy, reconciled it in Excel across 3 sites, and the report went out.",
        "Walked the ops lead through the occupancy recommendation so they stopped chasing the spreadsheet.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting" }
);
check(
  "vague 'intelligence inputs' / giving-partners tails are high severity",
  vagueIntel.some((i) => i.severity === "high" && /vague evidence/i.test(i.message)),
  messages(vagueIntel)
);

const ciFraming = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Built a Python refresh that joined 3 incomplete source files so the weekly source refresh stayed trustworthy.",
        "Found fragmented occupancy signals, synthesized them into 2 short competitive-landscape briefs the ops lead used at review.",
        "Walked stakeholders through the occupancy recommendation so the Friday chase on late files stopped for good.",
      ],
    },
    {
      company: "Project Human City",
      title: "Insights Analyst (Co-op)",
      bullets: [
        "Mapped inconsistent third-party source fields into shared definitions across 4 feeds so briefs stayed comparable week to week.",
        "Found recurring gaps in 5 incomplete market signals before the weekly stakeholder review, then flagged them.",
        "Reconciled client feedback with operating constraints so the team prioritized feasible changes before the next release.",
      ],
    },
  ],
  {
    expandedCount: 2,
    family: "consulting",
    jobTitle: "AI Market and Competitive Intelligence Analyst",
    jobDescription: "competitive intelligence source monitoring competitive landscape executive briefs Python SQL automation",
  }
);
check(
  "CI-framed bullets with magnitudes pass the CI posting gate",
  highSeverityCount(ciFraming) === 0,
  messages(ciFraming.filter((i) => i.severity === "high"))
);

// --------------------------------------- per-entry magnitude rule
// Every expanded software/analysis entry needs TWO numbered bullets (2 of 3).
const noNumbers = auditExperienceBullets(
  [
    {
      company: "INNWIL",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Built a Python refresh for the weekly export so partners stopped re-running it by hand.",
        "Fixed a slow SQL report by filtering before the join, then documented the change.",
        "Walked the ops lead through the new export format at sprint review.",
      ],
    },
    {
      company: "Project Human City",
      title: "Software Developer (Freelance)",
      bullets: [
        "Mapped 4 inconsistent source feeds into shared definitions for comparable reports.",
        "Fixed recurring mismatches before the weekly review, then flagged them for the team.",
        "Reconciled client feedback with constraints before release.",
      ],
    },
  ],
  { expandedCount: 2 }
);
check(
  "entry with no number anywhere is flagged",
  noNumbers.some((i) => i.company === "INNWIL" && i.severity === "high" && /no bullet in this entry carries a visible metric/.test(i.message)),
  messages(noNumbers)
);
check(
  "entry with one number is flagged for needing two",
  noNumbers.some((i) => i.company === "Project Human City" && i.severity === "high" && /only 1 visible metric/.test(i.message)),
  messages(noNumbers)
);
const twoNumbers = auditExperienceBullets(
  [
    {
      company: "Project Human City",
      title: "Software Developer (Freelance)",
      bullets: [
        "Mapped 4 inconsistent source feeds into shared definitions for comparable reports.",
        "Fixed recurring mismatches across 3 weekly reviews, then flagged them for the team.",
        "Reconciled client feedback with constraints before release.",
      ],
    },
  ],
  { expandedCount: 1 }
);
check(
  "entry with two numbered bullets passes the magnitude floor",
  !twoNumbers.some((i) => i.company === "Project Human City" && /visible metric/.test(i.message)),
  messages(twoNumbers)
);
// Written counts of abstractions don't register; written counts of work units do.
const weakVsStrong = auditExperienceBullets(
  [
    {
      company: "A",
      bullets: [
        "Built a Python refresh for the weekly export so partners stopped re-running it by hand.",
        "Fixed a slow SQL report by filtering before the join, then documented the change.",
        "Caught contract breaks before two scheduled release cycles reached production.",
      ],
    },
    {
      company: "B",
      bullets: [
        "Traced six release defects through logs and debugger sessions before the release.",
        "Fixed a slow SQL report that analysts waited 12 minutes on by filtering before the join, then documented the change.",
        "Walked the ops lead through the new export format at sprint review.",
      ],
    },
  ],
  { expandedCount: 2 }
);
check(
  "'two release cycles' (abstraction) is not a visible metric",
  weakVsStrong.some((i) => i.company === "A" && /visible metric/.test(i.message)),
  messages(weakVsStrong)
);
check(
  "'six release defects' (work unit) is a visible metric",
  !weakVsStrong.some((i) => i.company === "B" && /visible metric/.test(i.message)),
  messages(weakVsStrong)
);
// The verbatim-true anchor is exempt: SWE expanded set is the first two entries.
const anchorExempt = auditExperienceBullets(
  [
    {
      company: "A",
      bullets: [
        "Built a Python refresh that cut the weekly export from 40 minutes to under 5.",
        "Fixed a slow SQL report that analysts waited 12 minutes on by filtering before the join, then documented it in the runbook.",
        "Walked the ops lead through the new export format at sprint review.",
      ],
    },
    {
      company: "B",
      bullets: [
        "Shipped 3 internal dashboards for the support team after repeated ticket requests.",
        "Traced a flaky test to a timezone bug across 6 CI runs and pinned the fixture clock.",
        "Split the export work with another developer behind a feature flag.",
      ],
    },
    {
      company: "C",
      bullets: [
        "Added a retry around the partner feed so imports stopped dropping partial files.",
        "Documented the deploy checklist after a release missed a migration step.",
        "Reviewed pull requests for the reporting service.",
      ],
    },
  ],
  { expandedCount: 2 }
);
check(
  "non-expanded entry keeps no-number exemption",
  !anchorExempt.some((i) => i.company === "C" && /no bullet in this entry carries a visible metric/.test(i.message)),
  messages(anchorExempt)
);

const hyflexFrozen = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — ITS",
      title: "Student HyFlex Ambassador + Lab Monitor (Contract, Part-time)",
      bullets: [
        "Supported 30+ HyFlex hybrid classrooms with front-line troubleshooting across Windows and Linux systems, projectors, and audio setups, resolving issues in person and remotely.",
        "Installed and configured operating systems and classroom peripherals, keeping daily performance stable across lab spaces for students and faculty.",
        "Documented HyFlex procedures and trained faculty, reducing repeat support tickets; logged and escalated incidents per ITIL best practices.",
      ],
    },
  ],
  { expandedCount: 1, family: "consulting", jobTitle: "Consultant", jobDescription: "Client working sessions and proposals." }
);
check(
  "frozen HyFlex prose is not flagged as an unfalsifiable ending",
  !hyflexFrozen.some((i) => /unfalsifiable/.test(i.message)),
  messages(hyflexFrozen)
);

const extractionPlot = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab",
      title: "Business Analyst (Co-op)",
      bullets: [
        "Clarified 6 platform requirements with internal partners, separating extraction delays from user-facing needs before sprint planning.",
        "Analyzed 8 service handoffs and summarized operational impacts in a requirements note used during team reviews.",
        "Walked partners through the recommendation so the client working session ended with a written next step.",
      ],
    },
  ],
  {
    expandedCount: 1,
    family: "consulting",
    jobTitle: "Consultant - Cognizant Consulting",
    jobDescription: "Facilitate working sessions with clients and write proposals. Excel and PowerPoint.",
  }
);
check(
  "extraction-delay paraphrase is rejected on a no-coding consulting page",
  extractionPlot.some((i) => i.severity === "high" && /extraction delays|service handoffs|sprint planning/i.test(i.message)),
  messages(extractionPlot)
);

const phcParaphrase = auditExperienceBullets(
  [
    {
      company: "Project Human City",
      title: "Full-Stack Software Developer (Co-op)",
      bullets: [
        "Integrated third-party REST APIs into production clients, mapping external payloads into stable internal contracts across mobile and web surfaces.",
        "During 3 Agile release cycles, traced backend defects through HTTP logs and patched error handling before post-release delivery.",
        "Incorporated code review feedback into React components and added boundary checks, stopping malformed API responses from breaking community-facing screens.",
      ],
    },
  ],
  {
    expandedCount: 1,
    sourceEntries: [
      {
        company: "Project Human City",
        bullets: [
          "Integrated third-party REST APIs into production clients, mapping external payloads into stable internal contracts across mobile and web surfaces.",
          "Developed Kotlin Android and TypeScript React features against shared backends, keeping authentication and error handling consistent across clients.",
          "Diagnosed and fixed backend defects during release cycles, restoring reliability for community-facing users under real traffic.",
        ],
      },
    ],
  }
);
check(
  "reworded Project Human City master bullet is flagged as generic fallback",
  phcParaphrase.some((i) => i.severity === "high" && /reworded master|generic/i.test(i.message)),
  messages(phcParaphrase)
);

const shortStub = auditExperienceBullets(
  [
    {
      company: "Project Human City",
      title: "Full-Stack Software Developer (Co-op)",
      bullets: [
        "Translated three partner use cases into a TypeScript and React prototype.",
        "Resolved 8 JavaScript client defects across testing and release cycles by normalizing API errors before they reached shared screens.",
        "During Agile development, incorporated review feedback into shared authentication flows, preventing inconsistent error states across both production clients.",
      ],
    },
  ],
  { expandedCount: 1 }
);
check(
  "11-word expanded stub is high severity fallback",
  shortStub.some((i) => i.severity === "high" && /only 11 words|fallback/i.test(i.message)),
  messages(shortStub)
);

const softStuff = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Prioritized 6 artificial intelligence use cases from extraction bottlenecks.",
        "Built an 8-slide PowerPoint brief comparing automation options, so technical and business reviewers agreed on implementation scope.",
        "Applied organizational skills to consolidate sprint evidence into governance notes the delivery team used as a review checklist.",
      ],
    },
  ],
  { expandedCount: 1, family: "analyst", jobTitle: "Analyst - AI & Data", jobDescription: "PowerPoint Excel workshops." }
);
check(
  "organizational skills pasted into experience is high severity",
  softStuff.some((i) => i.severity === "high" && /organizational skills|soft-skill/i.test(i.message)),
  messages(softStuff)
);

const innwilHollow = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Framed 6 Artificial Intelligence use cases around the extraction prototype.",
        "Automated prototype data checks with Python, then summarized LLM limitations for nontechnical partners reviewing the proof of concept.",
        "Converted sprint findings into a 7-slide PowerPoint brief.",
      ],
    },
  ],
  { expandedCount: 1 }
);
check(
  "INNWIL hollow use-case stub is high severity",
  innwilHollow.some((i) => i.severity === "high" && /hollow|use cases/i.test(i.message)),
  messages(innwilHollow)
);
check(
  "INNWIL 7-slide PowerPoint stub is high severity",
  innwilHollow.some((i) => i.severity === "high" && /hollow|slide|PowerPoint|brief/i.test(i.message)),
  messages(innwilHollow)
);
check(
  "INNWIL under-floor stubs are high severity",
  innwilHollow.some((i) => i.severity === "high" && /only \d+ words/i.test(i.message)),
  messages(innwilHollow)
);

const inventOk = auditExperienceBullets(
  [
    {
      company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
      title: "Backend Software Developer Intern (Co-op)",
      bullets: [
        "Built a Python extraction service that moved 8 long-running tasks off request threads, preventing internal API timeouts during concurrent use.",
        "After code review exposed duplicated handlers, applied object-oriented design across Java and C++ API prototypes covered by 6 tests.",
        "Walked the team through the assigned component at sprint review after incorporating reviewer feedback.",
      ],
    },
  ],
  {
    expandedCount: 1,
    sourceEntries: [
      {
        company: "Seneca Polytechnic — INNWIL Lab | VYBE Platform",
        bullets: [
          "Built Python (FastAPI) REST services, decoupling heavy extraction from client paths so platform APIs stayed responsive under concurrent internal load.",
          "Automated GitHub Actions CI/CD with review gates and tests, standardizing how services reached production with fewer release regressions.",
          "Documented infrastructure tradeoffs in Confluence and worked Agile sprints, explaining reliability decisions to technical and non-technical partners.",
        ],
      },
    ],
  }
);
check(
  "inventing Java/C++ on experience is allowed (not flagged as invent)",
  !inventOk.some((i) => /invents (java|c\+\+)/i.test(i.message)),
  messages(inventOk)
);

const skillTex = String.raw`\section{Skills}
\begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
      \textbf{Methods}{: Requirements Gathering, Problem Solving, REST APIs \\}
      \textbf{Analytics \& Tools}{: PowerPoint, Word \\}
      \textbf{Professional}{: Communication, Problem Solving \\}
    }}
\end{itemize}
\section{Projects}`;
const pinned = pinBusinessSkills(skillTex, 0, { jobDescription: "Excel, Word, and PowerPoint for client proposals." });
const methods = pinned.match(/textbf\{Methods\}\{:([^}]*)\}/)?.[1] ?? "";
check("Problem Solving is not repeated under Methods", !/problem solving/i.test(methods), methods);
check("Problem Solving stays on Professional", /Problem Solving/.test(pinned));
check("REST APIs drop when the posting does not ask for APIs", !/REST APIs/i.test(pinned));
check("Word stays when the posting lists Word", /\bWord\b/.test(pinned), pinned.slice(pinned.indexOf("Skills"), pinned.indexOf("Projects")));

console.log(failures === 0 ? "all bullet-quality checks passed" : `${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
