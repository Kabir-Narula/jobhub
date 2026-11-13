/**
 * Sub-specialty craft engine + employer context + title calibration.
 *
 * Broad role families ("swe", "analyst", "consulting") tell the writer the
 * doctrine, but a Senior ML Engineer, Senior Security Engineer, Senior Frontend
 * Engineer, Staff Data Engineer, Senior Systems/C++ Engineer, and Senior
 * Supply-Chain Analyst look for completely different mechanisms and artifacts.
 *
 * This module sits on top of role-family without replacing it: it injects the
 * exact technical/domain depth a senior practitioner in THAT seat respects,
 * gives concrete context on the candidate's real past employers so invented
 * scenes never turn into generic placeholders, and calibrates the most recent
 * title for HR 7-second skim + iCIMS/Eightfold Role-Fit matching.
 */

import type { RoleFamily } from "./role-family";
import type { PostingFlavor } from "./hiring-screen";

export type SubSpecialty =
  | "ai-ml-rag"
  | "data-eng"
  | "frontend-ui"
  | "security-appsec"
  | "systems-cpp"
  | "cloud-sre"
  | "qa-sdet"
  | "mobile"
  | "backend-api"
  | "supply-ops-analyst"
  | "finance-risk-analyst"
  | "product-tpm"
  | "consulting-tech-strategy"
  | "general";

export function detectSubSpecialty(
  title: string,
  description: string,
  family: RoleFamily
): SubSpecialty {
  const t = title.toLowerCase();
  const head = `${title}\n${description.slice(0, 5000)}`.toLowerCase();

  if (family === "product") return "product-tpm";
  if (family === "consulting") return "consulting-tech-strategy";

  if (family === "analyst") {
    if (/\b(supply chain|logistics|inventory|warehouse|fulfillment|procurement|demand planning|merchandising|operations)\b/i.test(head)) {
      return "supply-ops-analyst";
    }
    if (/\b(capital markets|risk|credit|underwriting|financial|pricing|actuarial|treasury|portfolio|wealth|banking|fraud)\b/i.test(head)) {
      return "finance-risk-analyst";
    }
    return "general";
  }

  // Engineering / Data / Infra sub-specialties (title weighted heavily, then JD head)
  if (/\b(security|appsec|infosec|cyber|soc\b|iam\b|vulnerability|penetration|threat)\b/i.test(t) ||
      (/\b(owasp|csrf|xss|rbac|zero trust|siem|vulnerability|penetration|threat model)\b/i.test(head) && !/\bfrontend\b/i.test(t))) {
    return "security-appsec";
  }
  if (/\b(qa\b|sdet|quality assurance|test engineer|automation engineer|testing)\b/i.test(t) ||
      /\b(playwright|cypress|selenium|regression suite|test plan|flaky test)\b/i.test(t)) {
    return "qa-sdet";
  }
  if (/\b(embedded|firmware|systems engineer|c\+\+|kernel|compiler|graphics|game developer|low[- ]latency)\b/i.test(t) ||
      (/\b(c\+\+|rust|memory management|pointers|multithreading|concurrency|linux kernel|rtos)\b/i.test(head) && !/\b(react|next\.js|frontend)\b/i.test(t))) {
    return "systems-cpp";
  }
  if (/\b(android|ios|mobile|react native|flutter|swift|kotlin)\b/i.test(t)) {
    return "mobile";
  }
  if (/\b(front[- ]?end|ui engineer|ui developer|design systems?|web developer)\b/i.test(t) ||
      (/\b(react|angular|vue|svelte|css|accessibility|wcag|dom\b|webpack|vite)\b/i.test(head) && !/\b(backend|data engineer|devops|sre|ml)\b/i.test(t) && (head.match(/\b(react|angular|vue|css|frontend|front-end|ui)\b/gi)?.length ?? 0) >= 3)) {
    return "frontend-ui";
  }
  if (family === "data-ml" || /\b(machine learning|artificial intelligence|\bml\b|\bai\b|llm|rag\b|nlp|computer vision|genai|applied scientist)\b/i.test(t)) {
    if (/\b(data engineer|analytics engineer|etl|elt|databricks|snowflake|airflow|dbt|spark|warehouse|lakehouse|kafka)\b/i.test(head) &&
        !/\b(llm|rag|fine-?tun|prompt|hugging ?face|pytorch|tensorflow|nlp|computer vision)\b/i.test(t)) {
      return "data-eng";
    }
    return "ai-ml-rag";
  }
  if (family === "infra" || /\b(devops|sre|site reliability|platform engineer|cloud engineer|infrastructure)\b/i.test(t)) {
    return "cloud-sre";
  }
  if (/\b(data engineer|etl|airflow|spark|databricks|snowflake|dbt|bigquery)\b/i.test(head) &&
      (head.match(/\b(etl|elt|pipeline|warehouse|airflow|spark|databricks|snowflake|dbt|kafka)\b/gi)?.length ?? 0) >= 3) {
    return "data-eng";
  }
  if (/\b(back[- ]?end|api|distributed|microservices|platform)\b/i.test(t)) {
    return "backend-api";
  }
  return "general";
}

/**
 * Senior-practitioner craft brief: what a Principal/Staff/Senior in THIS exact
 * seat reads for to separate a real operator from keyword soup.
 */
export function craftBriefFor(
  sub: SubSpecialty,
  family: RoleFamily,
  hybrid = false
): string {
  if (hybrid) {
    return "HYBRID TECH-CONSULTING CRAFT: pair stakeholder/requirements discovery with real stack artifacts (typed UI components, REST integration contracts, SQL checks, CI/Git workflow) so both the consulting manager AND the tech lead see real delivery.";
  }

  switch (sub) {
    case "ai-ml-rag":
      return "SENIOR ML/AI CRAFT: name real failure modes and mechanisms — golden eval sets, prompt-regression fixtures, structured-output schema checks, heuristic fallback when LLM calls fail, chunking/retrieval filtering, latency/cost bounds, or confidence scoring. Never write vague 'built AI pipelines'.";
    case "data-eng":
      return "SENIOR DATA ENG CRAFT: name real data-engineering mechanisms — idempotent backfills, incremental watermarks, schema/contract validation on ingestion, deduplication keys, partitioning/filtering before joins, late-arriving record handling, or query scan reduction.";
    case "frontend-ui":
      return "SENIOR FRONTEND CRAFT: name real UI/browser mechanisms — optimistic updates with rollback, request cancellation/race guards, schema-validated forms, state normalization, memoized heavy renders, keyboard/ARIA accessibility, or responsive error boundaries. Not backend-index talk.";
    case "security-appsec":
      return "SENIOR SECURITY CRAFT: name real AppSec mechanisms — httpOnly/cookie session hardening, CSRF token checks, RBAC/ownership-scoped queries, rate limiting, input/schema validation at boundaries, row-level security, secret isolation, or audit logging.";
    case "systems-cpp":
      return "SENIOR SYSTEMS/C++ CRAFT: name real systems mechanisms — RAII/deterministic resource cleanup, bounded worker queues, lock/contention reduction, buffer/chunk streaming, hash-first deduplication (head-hash before full SHA-256), profiling bottlenecks, or deterministic exit/error handling.";
    case "cloud-sre":
      return "SENIOR SRE/PLATFORM CRAFT: name real infra mechanisms — isolated container workers, health checks/readiness, dead-letter/retry with backoff, CI review gates, flaky-test quarantine, build/cache speedups, structured logging, or reproducible environment configs.";
    case "qa-sdet":
      return "SENIOR QA/SDET CRAFT: name real quality-engineering mechanisms — deterministic test fixtures/seeds, API contract assertions, flaky-test isolation, regression suites wired into CI gates, boundary/negative input checks, or clear repro steps.";
    case "mobile":
      return "SENIOR MOBILE CRAFT: name real mobile mechanisms — offline/stale-state handling, normalized API response adapters, consistent auth token refresh, UI loading/error state recovery, or cross-client contract parity.";
    case "backend-api":
      return "SENIOR BACKEND CRAFT: name real backend mechanisms — composite SQL indexes, execution plan fixes, async worker queues off request paths, idempotent retries with backoff, typed request/response contracts, or N+1 elimination.";
    case "supply-ops-analyst":
      return "SENIOR SUPPLY-CHAIN / OPS CRAFT: speak operations — inventory/order mismatches, lead-time or stockout exceptions, fulfillment bottlenecks, vendor/store SKU reconciliation, aging open requests, weekly replenishment checks, and who acted on the report.";
    case "finance-risk-analyst":
      return "SENIOR FINANCE / RISK ANALYST CRAFT: speak analytical rigor — tie-out & reconciliation checks, period-over-period variance, exception flags for missing/mismatched records, SLA aging buckets, audit-ready workbooks/SQL pulls, and clear sign-off.";
    case "product-tpm":
      return "SENIOR PRODUCT / TPM CRAFT: focus on user friction uncovered, scope/priority tradeoffs (what stayed out and why), instrumentation/funnel checks, cross-team handoffs, and measurable adoption or cycle-time change.";
    case "consulting-tech-strategy":
      return "SENIOR CONSULTING CRAFT: frame Context -> Diagnosis -> Method -> Stakeholder Decision. Show how fragmented inputs, misaligned workflows, or manual chases became an actionable recommendation someone adopted.";
    default:
      return family === "analyst"
        ? "SENIOR ANALYST CRAFT: state the exact data flaw (duplicates, missing keys, stale feeds, manual re-entry), the reproducible check (SQL/Python/Excel), and who used the clean output."
        : "SENIOR SWE CRAFT: ground every bullet in a concrete trigger, a verifiable engineering mechanism, and an observable state change.";
  }
}

/**
 * Calibrated title suggestion for the most recent software entry (`entries[0]`)
 * to maximize 7-second HR skim + Workday/iCIMS/Eightfold title-fit scoring,
 * while staying strictly intern/co-op honest.
 */
export function recommendedTitleHint(args: {
  sub: SubSpecialty;
  family: RoleFamily;
  hybrid: boolean;
  wantsProgramming: boolean;
  flavor: PostingFlavor;
}): string {
  const { sub, family, hybrid, wantsProgramming, flavor } = args;
  if (family === "consulting" || family === "analyst" || family === "product") {
    if (flavor === "hr-tech") return "Systems Analyst Intern (Co-op) — NEVER Software Engineer on HR-tech";
    if (!wantsProgramming) return "Business Analyst / Operations Analyst Intern (Co-op) — ZERO engineering titles on no-coding JDs";
    if (hybrid) return "Systems Analyst Intern (Co-op) or Software Engineer Intern (Co-op) on the single CS bridge; Analyst-family on other software rows";
    if (flavor === "zs-sip") return "CS bridge on INNWIL if JD asks for code; Insights / Strategy Analyst on PHC";
    if (flavor === "zs-da") return "CS bridge on INNWIL if JD asks for code; Analytics Analyst on PHC";
    return "Keep 1 CS bridge on INNWIL only when JD asks for coding/SQL/automation; reword PHC to Analyst-family";
  }

  switch (sub) {
    case "ai-ml-rag":
      return "AI / ML Software Engineer Intern (Co-op) on entry 1 (never 'Data Scientist')";
    case "data-eng":
      return "Data Engineer Intern (Co-op) on entry 1";
    case "frontend-ui":
      return "Frontend Software Engineer Intern (Co-op) on entry 1";
    case "security-appsec":
      return "Application Security / Software Engineer Intern (Co-op) on entry 1";
    case "systems-cpp":
      return "Systems / Software Engineer Intern (Co-op) on entry 1";
    case "cloud-sre":
      return "Platform / DevOps Engineer Intern (Co-op) on entry 1";
    case "qa-sdet":
      return "QA Automation / Software Engineer Intern (Co-op) on entry 1";
    case "mobile":
      return "Mobile Software Engineer Intern (Co-op) on entry 1";
    case "backend-api":
      return "Backend Software Engineer Intern (Co-op) on entry 1";
    default:
      return "Match entry 1 title to the posting's family while keeping Intern (Co-op); keep 1 other entry's original title";
  }
}

/**
 * Real domain context for the candidate's past employers so invented scenes
 * read like an actual coworker wrote them rather than generic placeholders.
 */
export function employerWorldContext(business: boolean): string {
  if (business) {
    return [
      "- Seneca Polytechnic — INNWIL Lab | VYBE Platform (02/2026–04/2026): applied AI/innovation lab building internal document-extraction & workflow review tools for faculty/external partners. Real work surface: multi-stage document extraction, quality validation scripts, reviewer handoffs, partner use-case scoping.",
      "- Project Human City (05/2025–07/2025): nonprofit/community platform coordinating services across web & mobile clients with third-party data feeds. Real work surface: multi-source data consistency, partner requirements/UAT, client workflow error handling.",
      "- Seneca Polytechnic — ITS (HyFlex) & Student Services: FROZEN source bullets (live classroom AV/OS troubleshooting across 30+ rooms; 20+ Excel tracker items, faculty notice, 8–12 student peer-mentor groups).",
    ].join("\n");
  }
  return [
    "- Seneca Polytechnic — INNWIL Lab | VYBE Platform (02/2026–04/2026): applied AI/software lab building the VYBE extraction and internal review platform with a small dev team + non-technical partners. Good scene surfaces: async extraction jobs, prompt/parser checks, CI/PR test gates, partner review demos.",
    "- Project Human City (05/2025–07/2025): community platform with mobile + web clients integrating external partner APIs and shared auth/state. Good scene surfaces: typed client/API contracts, defect triage during releases, auth/error-state consistency, teammate code reviews.",
    "- Three of Cups (02/2024–04/2024): client web & operations software (freelance). Good scene surfaces: SQL indexing/query tuning, background export/batch workers, schema constraints, retry/runbook handoffs with the client.",
  ].join("\n");
}

/**
 * Extra domain-authentic mechanism terms so Frontend, Security, ML, Systems,
 * and QA bullets pass `bullet-quality.ts` mechanism checks cleanly without
 * forcing artificial SQL-index language onto a UI or AppSec bullet.
 */
export const SUB_SPECIALTY_TECHNIQUE_RE =
  /\b(?:memoiz\w*|optimistic|abortcontroller|debounce\w*|throttl\w*|aria|wcag|accessibility|layout shift|error boundary|hydration|csrf|xss|rbac|row[- ]level security|httponly|bcrypt|sanitiz\w*|rate[- ]limit\w*|token rotation|ownership[- ]scoped|raii|smart pointer\w*|mutex|lock[- ]free|ring buffer|head[- ]hash|sha-?256|flamegraph|profil\w*|zero[- ]copy|chunking|rerank\w*|eval(?:uation)? suite|golden (?:set|fixture)|structured output|confidence scor\w*|heuristic fallback|hallucination|watermark\w*|idempoten\w*|dead[- ]letter|health probe|readiness|rollback|quarantine|regression suite|repro(?:duction)? steps?|boundary check\w*|negative test\w*|n\+1|deadlock)\b/i;
