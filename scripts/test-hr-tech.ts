/**
 * HR-tech / techno-functional consulting fixes.
 * Run: npx tsx scripts/test-hr-tech.ts
 */
import { detectPostingFlavor, ensureHiringScreen, flavorDirective } from "../lib/tailor/hiring-screen";
import { claimableBusinessSkillItems } from "../lib/tailor/analyst-techniques";
import { finalizeBusinessTitle } from "../lib/tailor/generate";
import { auditExperienceBullets, highSeverityCount } from "../lib/tailor/bullet-quality";
import { BUSINESS_SKILL_SUPPRESS } from "../lib/tailor/lens";
import { claimableJdTerms } from "../lib/tailor/match";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`ok    ${name}`);
  }
}

const IBM_HR_JD = `
Your role and responsibilities
As an HR Technology Associate Consultant, you will support the delivery of HR systems projects.
Learn HR Technology Platforms such as SAP SuccessFactors.
Participate in workshops with clients to understand their needs and document technical integration requirements.
Support techno-functional development: HR APIs, integration flows, SSO, troubleshooting connectivity.
Test System Functionality: running test scripts, checking results.
Required: Java Script or Python, Knowledge of developing or working with APIs.
This opportunity supports Associate Consultant hiring cohorts commencing in May 2027.
Successful applicants must have graduated from a recognized post-secondary institution.
`;

check(
  "IBM SuccessFactors JD is hr-tech flavor",
  detectPostingFlavor("HR Technology Developer Associate", IBM_HR_JD, "consulting") === "hr-tech"
);

check(
  "hr-tech directive mentions workshops and SuccessFactors map",
  /workshop/i.test(flavorDirective("hr-tech")) && /SuccessFactors/i.test(flavorDirective("hr-tech"))
);

const screen = ensureHiringScreen(
  ["Be a team player", "Show communication", "Learn quickly"],
  "consulting",
  "HR Technology Developer Associate",
  IBM_HR_JD
);
check(
  "ensureHiringScreen merges HR-tech fallbacks into a thin model screen",
  screen.length >= 5 && screen.some((s) => /workshop|SuccessFactors|UAT|techno-functional/i.test(s)),
  screen.join(" | ")
);

const skills = claimableBusinessSkillItems(IBM_HR_JD, "consulting");
check(
  "hiring cohorts do not inject Segmentation",
  !skills.some((s) => /segmentation/i.test(s)),
  skills.join(", ")
);
check(
  "post-secondary does not inject Secondary Research",
  !skills.some((s) => /secondary research/i.test(s)),
  skills.join(", ")
);
check(
  "HR-tech JD claims Process Mapping / Requirements / Python / REST",
  skills.some((s) => /process mapping/i.test(s)) &&
    skills.some((s) => /requirements/i.test(s)) &&
    skills.some((s) => /python/i.test(s)) &&
    skills.some((s) => /rest/i.test(s)),
  skills.join(", ")
);

check(
  "Distributed Systems is suppressed on business resumes",
  BUSINESS_SKILL_SUPPRESS.some((s) => /distributed systems/i.test(s)) &&
    BUSINESS_SKILL_SUPPRESS.some((s) => /ci\/cd/i.test(s))
);

check(
  "hr-tech non-bridge title becomes Systems Analyst",
  finalizeBusinessTitle("Software Engineer (Co-op)", "Software Engineer (Co-op)", false, "hr-tech") ===
    "Systems Analyst (Co-op)"
);
check(
  "hr-tech still keeps CS bridge",
  /software engineer intern/i.test(
    finalizeBusinessTitle("Software Engineer Intern (Co-op)", "Business Analyst (Co-op)", true, "hr-tech")
  )
);
check(
  "non-hr-tech still forces Business Analyst",
  finalizeBusinessTitle("Software Engineer (Co-op)", "Software Engineer (Co-op)", false, "consulting-general") ===
    "Business Analyst (Co-op)"
);

const bad = auditExperienceBullets(
  [
    {
      company: "INNWIL",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Mapped integration requirements and REST API data handoffs before Python automation moved extraction outside client workflows.",
        "Diagnosed release regressions through test results and review gates, then documented fixes for technical partners.",
        "Tracked sprint decisions with teammates, keeping service changes aligned with agreed delivery priorities across 2 cycles.",
      ],
    },
    {
      company: "PHC",
      title: "Business Analyst (Co-op)",
      bullets: [
        "Clarified third-party integration needs and mapped external data into shared contracts for developers.",
        "Investigated release defects across client workflows and prioritized fixes before launch with the team.",
        "Compared issues across 2 client engagements, turning recurring integration gaps into recommendations.",
      ],
    },
  ],
  {
    family: "consulting",
    expandedCount: 2,
    jobTitle: "HR Technology Developer Associate",
    jobDescription: IBM_HR_JD,
  }
);
check(
  "pure REST-handoff / release-regression page fails HR-tech audit",
  highSeverityCount(bad) > 0,
  bad
    .filter((i) => i.severity === "high")
    .map((i) => i.message)
    .slice(0, 3)
    .join(" || ")
);

const good = auditExperienceBullets(
  [
    {
      company: "INNWIL",
      title: "Software Engineer Intern (Co-op)",
      bullets: [
        "Clarified integration requirements with partners before a Python job moved extraction outside client workflows.",
        "Ran acceptance checks against expected handoffs, then documented gaps for technical and non-technical stakeholders.",
        "Walked teammates through unresolved delivery risks in sprint reviews so process owners could prioritize fixes.",
      ],
    },
    {
      company: "PHC",
      title: "Systems Analyst (Co-op)",
      bullets: [
        "Facilitated discovery walkthroughs to capture third-party integration requirements and acceptance criteria.",
        "Documented process gaps across client workflows, then handed a requirements note to developers before launch.",
        "Compared issues across 2 client engagements and turned recurring onboarding gaps into delivery recommendations.",
      ],
    },
  ],
  {
    family: "consulting",
    expandedCount: 2,
    jobTitle: "HR Technology Developer Associate",
    jobDescription: IBM_HR_JD,
  }
);
check(
  "workshop / requirements / acceptance page passes HR-tech framing gate",
  !good.some((i) => i.severity === "high" && /HR-tech|REST|release regression|data handoff/i.test(i.message)),
  good
    .filter((i) => i.severity === "high")
    .map((i) => i.message)
    .join(" || ")
);

const terms = claimableJdTerms(IBM_HR_JD, 40, ["ibm"], "HR Technology Developer Associate");
check(
  "hybrid cloud and software development are not scored",
  !terms.some((t) => /hybrid cloud|software development/i.test(t)),
  terms.join(", ")
);

console.log(failures === 0 ? "\nall hr-tech checks passed" : `\n${failures} check(s) FAILED`);
if (failures > 0) process.exit(1);
