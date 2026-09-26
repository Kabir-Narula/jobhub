/**
 * Hiring-screen rules for resume generation.
 *
 * Live Reddit is preferred. When PullPush is empty or the research model
 * returns nothing useful, these JD+family fallbacks still give the tailor
 * concrete recruiter/HR targets — empty intel was why Autodesk CI shipped
 * generic BA/product bullets.
 */

import type { RoleFamily } from "./role-family";

export type PostingFlavor =
  | "hr-tech"
  | "zs-sip"
  | "zs-da"
  | "competitive-intel"
  | "insights"
  | "silent-mbb"
  | "analyst-general"
  | "consulting-general"
  | "default";

const HR_TECH_SIGNAL =
  /successfactors|hr technology|hris|\bhcm\b|techno-?functional|\bworkday\b|client workshop|test scripts?|\buat\b|hr apis?|hr systems?|people processes?/i;

const ZS_DA_SIGNAL =
  /decision analytics|statistical models?|\bSAS\b|\bVBA\b|visual basic|hadoop eco|design custom analyses in R/i;

const ZS_SIP_SIGNAL =
  /strategy insights|insights\s*&\s*planning|desk research|confirmit|market research and\/or desk research/i;

export function detectPostingFlavor(title: string, description: string, family: RoleFamily): PostingFlavor {
  if (family !== "consulting" && family !== "analyst" && family !== "product") return "default";
  const t = `${title}\n${description}`;
  // HR-tech / techno-functional before insights — "segmentation" must not steal SuccessFactors JDs.
  if (HR_TECH_SIGNAL.test(t)) return "hr-tech";
  // ZS Decision Analytics before generic insights (Tableau/KPI would otherwise steal it).
  if (ZS_DA_SIGNAL.test(t)) return "zs-da";
  // ZS Strategy Insights & Planning — desk/market research consulting, Excel-first.
  if (ZS_SIP_SIGNAL.test(t)) return "zs-sip";
  if (/competitive intelligence|market(?:ing)? intelligence|\bcompetitive landscape\b|source monitor/i.test(t)) {
    return "competitive-intel";
  }
  if (/\binsights?\b|\bkpis?\b|dashboard|market research|segmentation/i.test(t)) return "insights";
  if (family === "consulting" && !/\bexcel\b|\bsql\b|\bpython\b|\bpowerpoint\b|\btableau\b/i.test(t)) {
    return "silent-mbb";
  }
  if (family === "consulting") return "consulting-general";
  return "analyst-general";
}

/**
 * Deep JD read protocol — what the employer cares about, not word frequency.
 * Injected into every generate payload so vague/generic bullets lose to evidence.
 */
export const JD_DEEP_ANALYSIS_PROTOCOL = `Before writing any bullet, deeply analyze job.description (and posting_url context). Decide what the employer CARES ABOUT — not merely which words appear most often.

Split the posting into:
- mandatory requirements vs preferred requirements vs contextual/nice-to-have skills
- core responsibilities vs supporting responsibilities
- recurring terminology worth mirroring vs low-value wording to ignore
- domain expectations and business concepts (markets, customers, decisions)
- technologies and methodologies that are real asks vs buzzword garnish
- seniority signals and behavioral expectations (ownership, collaboration, judgment)
- screening requirements (what kills a resume in 10 seconds) vs differentiating signals (what wins the interview)
- implicit competencies (synthesis, source monitoring, stakeholder briefs) not spelled as tool names

For each experience entry, map candidate work onto these evidence axes when they fit THIS posting:
responsibilities · environment · business context · technologies · workflows · scope · collaboration · ownership · problem-solving · implementation · maintenance · optimization · delivery · outcomes · operational context · target-role relevance

Rewrite weak, vague, repetitive, generic, or underdeveloped material into stronger professional evidence:
- BAD: "giving partners repeatable intelligence inputs", "helping technical and non-technical partners choose a path", "reducing manual checks before findings reached stakeholders"
- GOOD: name the artifact (source refresh, brief, tracker), the problem (incomplete/fragmented inputs, late file, chase), the method, and the observable outcome (chase stopped, brief used, report went out clean)
- Every bullet must answer: what changed, for whom, and why a screener for THIS role would care.
- Drop low-value wording. Prefer the posting's domain nouns for core responsibilities; keep preferred tools in skills unless a bullet truly used that work type.`;

/** JD-derived screen when Reddit/research returns nothing usable. */
export function hiringScreenFallback(
  family: RoleFamily,
  title: string,
  description: string
): string[] {
  const flavor = detectPostingFlavor(title, description, family);
  if (flavor === "zs-sip") {
    return [
      "ZS Strategy Insights & Planning screen: problem → desk/market research → structured Excel analysis → synthesized insight → client-ready recommendation",
      "Lead with frameworks and structured problem-solving on client business questions — not SWE build/fix language",
      "Show market research or desk research that produced a decision-useful insight (sources compared, gap found, recommendation used)",
      "Excel / Office analyses are the default toolkit; never invent Confirmit, Access, or ZS proprietary tools as products you used — map to Excel models, secondary research, or survey-style synthesis",
      "CS bridge: at most ONE light Python/SQL/automation bullet ending in stakeholder or insight use; other bullets = research, synthesis, recommendation",
      "Non-bridge titles: Insights Analyst or Strategy Analyst — never Consultant, never leave Software Engineer",
      "Quantify ownership and follow-through (deliverables owned, sources compared, hours/cycle, briefs); Achievements help prove initiative and work ethic ZS screens for",
      "Every claim must survive an EBI probe — interviewers walk the resume line by line (r/zs_associates)",
      "At least two magnitudes on the page; HyFlex 30+ rooms counts as only one",
    ];
  }
  if (flavor === "zs-da") {
    return [
      "ZS Decision Analytics screen: business question → quantitative method → analysis artifact → client decision — not ML engineering or FastAPI services",
      "Show custom analyses that guided a decision: Excel models, SQL pulls, Python scripts, dashboards built in Excel — never invent Tableau, SAS, R, or VBA as tools you used",
      "Map JD Tableau/SAS/R/VBA to intern-defensible Python/SQL/Excel analysis; map Hadoop to database/SQL exposure only if truthful",
      "CS bridge: up to TWO Python/SQL/automation bullets ending in stakeholder use; one synthesis/recommendation bullet",
      "Non-bridge titles: Analytics Analyst or Decision Analytics Analyst — analysis + client communication, not release QA",
      "Synthesize results into oral/written presentation language: brief, deck, status update, recommendation a client could act on",
      "Resume will be probed deeply (projects, internships, puzzles/calm under EBI) — every bullet must be interview-defensible",
      "At least two magnitudes on the page; HyFlex 30+ rooms counts as only one",
    ];
  }
  if (flavor === "hr-tech") {
    return [
      "Frame work as techno-functional consulting: people/HR processes + system integration clarification — not classic MBB case decks and not SWE release QA",
      "Show client/stakeholder workshops or discovery walkthroughs mapped from real advising, faculty walkthroughs, or requirements conversations",
      "Document requirements / process gaps / data-flow or handoff notes a senior consultant could use — never API field dumps",
      "When the JD names SuccessFactors/Workday/HRIS: never claim you used the product; map to HR process learning, integration needs, SSO/identity clarification, and acceptance testing",
      "CS bridge: at most ONE light Python/API/automation bullet ending in stakeholder or process use; other two bullets = requirements, workshop/handoff, or UAT/test scripts",
      "Non-bridge software rows: HR Technology Analyst / Systems Analyst language — process, requirements, acceptance — not REST handoffs or release regressions",
      "Evidence of initiative and follow-through (hackathons, academic projects, self-directed builds) belongs in Achievements when the JD asks for dedication",
      "At least two magnitudes on the page; HyFlex 30+ rooms counts as only one",
    ];
  }
  if (flavor === "competitive-intel") {
    return [
      "Lead with source monitoring / multi-source refresh and synthesis of incomplete market signals — not generic defect tickets",
      "Show briefs or recommendations a business/product stakeholder could use (competitive landscape, gaps, what changed)",
      "When the JD asks for Python/SQL/automation: keep ONE engineer/CS-titled role whose bullets build the systems that produce intelligence, ending in stakeholder use",
      "Other software co-ops become Analyst/Insights language: fragmented sources → shared definitions → decision, not mobile/web or release QA",
      "Never invent PitchBook/Tableau/IQVIA/Confluence as tools you used; map vendors to intern-defensible synthesis",
      "Put at least two magnitudes on the page (counts of sources/briefs/sites, cycle time) — HyFlex's 30+ rooms counts as only one",
      "Bullets must show concrete artifacts + outcomes — ban vague 'intelligence inputs' / 'helping partners choose a path' filler",
    ];
  }
  if (flavor === "insights") {
    return [
      "Bullets are question → method you choose → what a stakeholder did with the insight",
      "Dashboards/KPIs/segmentation language only when the posting makes them real; never stamp INDEX/MATCH",
      "Keep one CS bridge if the JD is technical; otherwise lead with analysis and recommendation",
      "Map Qualtrics/Nielsen/Tableau JD words to secondary research / Excel dashboard — do not invent those products",
      "At least two magnitudes on the page; HyFlex 30+ counts as only one",
      "Rewrite vague 'supported analysis' lines into artifact + method + stakeholder use",
    ];
  }
  if (flavor === "silent-mbb") {
    return [
      "CAR bullets: diagnose → analyze → a decision or chase that stopped — partners screen for judgment, not tools",
      "Do not fill a tool-silent posting with Pivot Tables, INDEX/MATCH, or Power Query",
      "Keep exactly one engineer/CS title; other software rows → Business Analyst language",
      "Campus ops stay real (HyFlex restore, office tracker) — never rewrite as Excel jobs",
      "At least two magnitudes; prefer hours saved / cycle time / stakeholder counts over automation %",
      "Mandatory vs preferred: only mirror tools the JD actually requires; judgment beats keyword density",
    ];
  }
  if (family === "consulting" || family === "analyst") {
    return [
      "CAR shape; diagnosis and stakeholder use must be visible on a 10-second skim",
      "Methods come from THIS posting — do not stamp a fixed Excel-function template",
      "One CS bridge title max; campus-ops titles frozen",
      "At least two magnitudes on the page",
      "Analyze mandatory vs preferred vs low-value wording before choosing skills or bullet framing",
    ];
  }
  if (family === "product") {
    return [
      "Users, tradeoffs, stakeholders — not a stack dump",
      "Keep one CS bridge; frame other work toward product decisions",
      "Evidence axes: ownership, collaboration, delivery, outcomes — not feature laundry lists",
    ];
  }
  return [];
}

export function flavorDirective(flavor: PostingFlavor): string {
  switch (flavor) {
    case "zs-sip":
      return `POSTING FLAVOR = ZS Strategy Insights & Planning Associate. Reader is a ZS insights consulting screener (client-first, EBI-heavy). Shape every non-campus entry as: client/business problem → market or desk research → structured Excel/Office analysis → synthesized insight → recommendation a client or ZS team could use. CS bridge: at most ONE light Python/SQL/automation bullet ending in insight/stakeholder use. Non-bridge titles: Insights Analyst or Strategy Analyst — never Consultant. NEVER invent Confirmit, Microsoft Access, or ZS proprietary software as tools you used — map to Excel models, secondary/desk research, and written briefs. Ban REST handoffs, release regressions, and FastAPI. Prefer Achievements when the JD stresses initiative, work ethic, and ownership. Every bullet must survive a line-by-line resume probe.`;
    case "zs-da":
      return `POSTING FLAVOR = ZS Decision Analytics Associate. Reader is a ZS analytics consulting screener. Shape every non-campus entry as: business question → quantitative method → analysis artifact (Excel model, SQL pull, Python script, Excel dashboard) → client decision or recommendation. CS bridge: up to TWO Python/SQL/automation bullets ending in stakeholder use; one synthesis/presentation bullet. Non-bridge titles: Analytics Analyst or Decision Analytics Analyst. NEVER invent Tableau, SAS, R, VBA, or Hadoop as tools you used — map to Python, SQL, Excel analysis, and Excel dashboards. Ban SWE release-QA language. Synthesize into presentation/brief language. Every bullet must be EBI-defensible.`;
    case "hr-tech":
      return `POSTING FLAVOR = hr-tech / techno-functional consulting (IBM-style HR Technology Associate). Reader is an HR-tech consulting screener, not MBB case partners and not a staff engineer. Every non-campus entry must advance: client/stakeholder workshops or discovery; requirements or process-gap notes; techno-functional integration clarification (SSO/identity/API handoffs as coordination, not building the service); UAT / test scripts / acceptance; or project coordination. CS bridge: at most ONE light Python/API/automation bullet ending in stakeholder or process use; the other two = requirements, workshop/handoff, or acceptance testing. Non-bridge titles: HR Technology Analyst or Systems Analyst — never leave them as Software Engineer, never Consultant. NEVER invent SuccessFactors, Workday, SAP, or any HRIS as a product you used — if the JD names them, map to "documented HR process / integration needs / test cases for an HR platform rollout". Ban REST API data-handoff and release-regression language as the story. Prefer Achievements when the JD asks for hackathons / dedication / self-directed work.`;
    case "competitive-intel":
      return `POSTING FLAVOR = competitive-intelligence. Every software entry (except HyFlex/office) must advance source monitoring, fragmented/incomplete sources, landscape synthesis, or an executive-ready brief. CS bridge: Python/SQL/scheduled refresh that produces intelligence inputs, plus one synthesis/recommendation bullet. Non-bridge software: Analyst language — never "mobile and web", release defects, authentication, or infrastructure tradeoffs. Never invent Confluence/PitchBook/Tableau. Prefer JobHub/Expense Manager projects for multi-source refresh. Ban vague filler ("repeatable intelligence inputs", "helping partners choose a path").`;
    case "insights":
      return `POSTING FLAVOR = insights/KPI. Question → method → stakeholder use. CS bridge only as technical as the JD. No product-QA language on Analyst rows. No vague "supported insights" lines.`;
    case "silent-mbb":
      return `POSTING FLAVOR = tool-silent consulting. Diagnosis and recommendation over tools. Do not invent Excel function names. One light technical bullet on the CS bridge max.`;
    case "consulting-general":
      return `POSTING FLAVOR = consulting. CAR bullets; tools only when the JD makes them relevant.`;
    case "analyst-general":
      return `POSTING FLAVOR = analyst. Methods from the JD; no Pivot/INDEX-MATCH stamp.`;
    default:
      return "";
  }
}

/** Merge model output with fallbacks; never return an empty screen for business families. */
export function ensureHiringScreen(
  fromModel: string[] | undefined,
  family: RoleFamily,
  title: string,
  description: string
): string[] {
  const cleaned = (fromModel ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const flavor = detectPostingFlavor(title, description, family);
  // Generic research screens often return ≥3 vague bullets. For high-stakes
  // ZS / HR-tech flavors, always merge ≥2 fallback lines even when the model filled the quota.
  const forceMergeFlavors = flavor === "hr-tech" || flavor === "zs-sip" || flavor === "zs-da";
  if (cleaned.length >= 3 && !forceMergeFlavors) return cleaned;
  const fallback = hiringScreenFallback(family, title, description);
  if (!fallback.length) return cleaned;
  const forceMerge = forceMergeFlavors && cleaned.length >= 3;
  let mergedFromFallback = 0;
  const seen = new Set(cleaned.map((s) => s.toLowerCase()));
  for (const f of fallback) {
    if (cleaned.length >= 8) break;
    if (seen.has(f.toLowerCase())) continue;
    if (forceMerge && mergedFromFallback >= 2) break;
    cleaned.push(f);
    seen.add(f.toLowerCase());
    mergedFromFallback++;
  }
  return cleaned;
}

// ---------- employer archetypes (company screen culture — every role family) ----------

/**
 * Posting flavor describes the ROLE (business families only). The employer
 * archetype describes the COMPANY's screen — and it applies to SWE and data
 * roles too: an RBC campus posting and a Wealthsimple posting with identical
 * JDs pass different screens (Workday keyword match + behavioral STAR stories
 * vs proof-of-impact + GitHub). Encoded from official campus-program pages and
 * recruiter guidance (see scripts/test-hiring-screen.ts for the contract).
 */
export type EmployerArchetype =
  | "bank-campus" // Big-5 banks, Capital One, CPP: Workday ATS, co-op conversion, STAR behavioral rounds
  | "fintech-scaleup" // Wealthsimple/Shopify/Toast/Affirm/Justworks: proof-of-impact, GitHub, ownership
  | "institutional-grad" // Bell/TELUS/Sun Life/AIG/CGI/Mastercard/TR: rotational programs, leadership potential, eligibility
  | "econ-consulting" // Cornerstone/CRA/FTI econ: quantitative rigor, transcripts, research
  | "big4" // Deloitte/PwC/KPMG/EY/Accenture: ATS keywords + client delivery over pedigree
  | "mbb-tier2" // MBB + Kearney/OW/RB/Strategy&/EY-P/ZS/boutiques: 30-second screen, XYZ bullets
  | "none";

const BANK_RE =
  /\b(rbc|royal bank|scotiabank|bank of nova scotia|td bank|td securities|\btd\b|bmo|bank of montreal|cibc|capital one|cpp investments|national bank|manulife|tangerine|equitable bank|desjardins)\b/i;
const FINTECH_RE =
  /\b(wealthsimple|shopify|toast(?:tab)?|affirm|justworks|koho|wave(?:apps| financial)?|freshbooks|league|clio|stackadapt|clearco|borrowell)\b/i;
const INSTITUTIONAL_RE =
  /\b(bell|telus|sun life|\baig\b|cgi|mastercard|thomson reuters|rogers|shaw|cibc wood gundy|ontario teachers|otpp|omers)\b/i;
const ECON_RE = /\b(cornerstone research|charles river|\bcrai?\b|analysis group|\bnera\b|fti consulting|compass lexecon)\b/i;
const BIG4_RE = /\b(deloitte|\bpwc\b|pricewaterhousecoopers|kpmg|\bey\b|ernst\s*(?:&|and)\s*young|accenture)\b/i;
const MBB_T2_RE =
  /\b(mckinsey|boston consulting|\bbcg\b|bain\b|kearney|oliver wyman|roland berger|strategy&|ey-parthenon|parthenon|\blek\b|altman solon|simon-kucher|oc&c|\bzs\b(?:\s|$))/i;
const ROTATIONAL_JD_RE =
  /\b(graduate (?:technology |leadership )?program|rotational program|rotation(?:al)?s?\b|launch program|new[- ]grad (?:program|rotation)|early careers? (?:program|analyst)|amplify|velocity program|\btilt\b|leadership development program)\b/i;

export function detectEmployerArchetype(company: string, title: string, description = ""): EmployerArchetype {
  const c = company.trim();
  if (ECON_RE.test(c)) return "econ-consulting";
  if (MBB_T2_RE.test(c)) return "mbb-tier2";
  if (BIG4_RE.test(c)) return "big4";
  if (BANK_RE.test(c)) return "bank-campus";
  if (FINTECH_RE.test(c)) return "fintech-scaleup";
  if (INSTITUTIONAL_RE.test(c)) return "institutional-grad";
  // Unknown company, but the posting itself is a rotational/graduate program.
  if (ROTATIONAL_JD_RE.test(`${title}\n${description.slice(0, 1500)}`)) return "institutional-grad";
  return "none";
}

/** What this employer's new-grad screen provably rewards (hiring-screen lines). */
export function archetypeScreen(archetype: EmployerArchetype): string[] {
  switch (archetype) {
    case "bank-campus":
      return [
        "Bank campus screen (Workday ATS): mirror the posting's exact tools in skills — TD interviewers quiz whatever the resume lists, so claim only what survives trivia",
        "Eligibility is a hard filter: the graduation window must be obvious (Education line carries it)",
        "Banks name hackathons, case competitions, and clubs as screening keywords (RBC Amplify, Scotiabank) — the Achievements section is load-bearing here",
        "Every bullet must expand into a STAR story — behavioral rounds (RBC adds a GROUP interview) probe teamwork, conflict, and ownership",
        "Quantified analytical bullets read as 'data-driven decision making', the exact phrase these postings screen for",
        "Community/volunteer and leadership evidence is explicitly screened (CIBC names it); prior co-op outcomes beat projects",
      ];
    case "fintech-scaleup":
      return [
        "Proof-of-impact screen (Wealthsimple requires a proof-of-impact artifact; Shopify reviews your GitHub): shipped, in-the-world results beat credentials",
        "Keep the most relevant GitHub-linked project prominent — these screeners actually open the repo",
        "Ownership language: shipped, owned, made better — founder-energy without inflated scope",
        "Name real AI/LLM work plainly — 'AI-native' is a stated plus (Wealthsimple); buzzwords without artifacts read as noise",
        "GPA and formality carry ~zero weight here — spend the space on what you built",
      ];
    case "institutional-grad":
      return [
        "Rotational/graduate-program screen: 'demonstrated leadership potential' is a written requirement (TELUS GTLP) — led/organized/mentored evidence must be visible, campus-ops mentoring counts",
        "Eligibility gates are hard: graduation window and prior co-op (TELUS wants 4-12 months) should be unmistakable",
        "SuccessFactors/Workday keyword parse before any human — mirror posting nouns in skills",
        "Communication is screened via video interviews; clean plain-English bullets double as evidence",
        "Adaptability across rotations: show range (analysis + build + people) rather than one repeated shape",
      ];
    case "econ-consulting":
      return [
        "Economic-consulting screen (Cornerstone/CRA/FTI): quantitative rigor first — name real methods (regression, Python/SQL analysis, reconciliation) truthfully",
        "Transcripts are submitted with the application — academic signals (scholarship, coursework) carry unusual weight; the Achievements section matters",
        "Research experience and written communication are screened explicitly — a brief or writeup artifact beats a tool list",
        "Never invent Stata/R/Matlab — map JD mentions to Python/Excel analysis the candidate can defend",
      ];
    case "big4":
      return [
        "Big 4 screen: ATS keyword match matters more than at MBB — mirror the posting's tools and certifications language in skills",
        "Client-facing delivery evidence beats pedigree: workshops, handoffs, deliverables someone used",
        "Deloitte publishes a 3.0 GPA floor — academics are a checkbox, not the differentiator; delivery stories are",
        "Tools lines carry real weight here (Excel, SQL, PowerPoint, dashboards) — unlike MBB, name them when the posting does",
      ];
    case "mbb-tier2":
      return [
        "30-second screen: the strongest brand, award, and leadership line must sit in the top third of the page",
        "XYZ/CAR bullets — what you did, how, and the resulting change; responsibility-shaped bullets are the #1 rejection cause",
        "Quantify every expanded entry; vague quantification ('improved efficiency significantly') reads as no evidence",
        "Leadership progression and entrepreneurial drive are explicit McKinsey/BCG screens — founded/created/organized counts (hackathon finals, projects with users)",
        "One page, no filler skills (never Word-level), awards/selectivity markers visible (the scholarship is one)",
      ];
    default:
      return [];
  }
}

/** Short lens line appended to lens_directive — what to foreground for this employer. */
export function archetypeLensLine(archetype: EmployerArchetype): string {
  switch (archetype) {
    case "bank-campus":
      return "EMPLOYER LENS (bank campus): foreground reliability, data integrity, reconciliation/quality work, and teamwork evidence; banks read carefulness as competence. One page, plain ATS-parseable nouns.";
    case "fintech-scaleup":
      return "EMPLOYER LENS (fintech/product tech): foreground shipped product impact and end-to-end ownership; the best project repo link is evidence, not decoration.";
    case "institutional-grad":
      return "EMPLOYER LENS (rotational/graduate program): foreground leadership-of-people evidence (mentoring, organizing, front-desk ownership) alongside the technical work; range beats depth.";
    case "econ-consulting":
      return "EMPLOYER LENS (economic consulting): foreground quantitative method and written deliverables; precision of method names matters more than tool breadth.";
    case "big4":
      return "EMPLOYER LENS (Big 4): foreground client delivery and the posting's exact tool vocabulary; practical over impressive.";
    case "mbb-tier2":
      return "EMPLOYER LENS (MBB/Tier-2): foreground diagnosis, leadership progression, and quantified outcomes; top-third strength decides the screen.";
    default:
      return "";
  }
}

/** Dedupe-merge extra screen lines into a base list, preserving order. */
export function mergeScreenLines(base: string[], extra: string[], cap = 12): string[] {
  const out = base.map((s) => s.trim()).filter(Boolean);
  const seen = new Set(out.map((s) => s.toLowerCase()));
  for (const line of extra) {
    const t = line.trim();
    if (!t || seen.has(t.toLowerCase()) || out.length >= cap) continue;
    out.push(t);
    seen.add(t.toLowerCase());
  }
  return out;
}
