/**
 * Deterministic audit of generated experience bullets against the bullet
 * doctrine in generate.ts. Prompt rules alone do not hold: the model drifts back
 * to filler, keyword lists, and three-identical-shapes entries, and nothing in
 * the pipeline noticed. This turns the doctrine into a check the route can act
 * on, feeding specific failures back for one repair pass.
 *
 * Severity split matters for cost: only "high" issues justify another
 * quality-tier LLM call, so cosmetic drift never doubles the request.
 */

import { isCampusOpsEntry, jdWantsProgramming } from "./role-family";
import { bulletsTooAlike } from "./projects";

export interface BulletIssue {
  company: string;
  severity: "high" | "low";
  message: string;
}

/** Filler that says nothing — the classic vague-bullet opener. */
const FILLER =
  /\b(?:worked on|helped (?:with|to)|assisted (?:with|in)|was responsible for|responsible for|involved in|participated in|contributed to|various|multiple|successfully|utiliz\w+|leverag\w+|as needed|among others|etc\.)\b/i;

/** Empty professional-sounding tails that avoid naming an artifact or outcome. */
const VAGUE_EVIDENCE =
  /\b(?:helping (?:technical and non-technical )?partners?|repeatable intelligence inputs|intelligence inputs|choose a path|findings reached stakeholders|supported (?:the )?(?:team|analysis|insights)|drove improvements?|improved (?:processes?|efficiency|communication)|partner questions became|shared reference|consistent field definitions|data-flow tradeoffs|acceptance criteria for each delivery|technical and non-technical partners followed)\b/i;

/**
 * Soft-skill names pasted into experience for ATS. Belong on Professional skills
 * only — "Applied organizational skills…" is the Deloitte nonsense tell.
 */
const SOFT_SKILL_STUFFING =
  /\b(?:organizational skills|verbal communication|written communication|communication skills|attention to detail|problem[- ]solving skills)\b/i;
/** Arabic digits or small written counts (model often writes "eight sources"). */
const HAS_MAGNITUDE =
  /\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|twenty|thirty)\b/i;

/**
 * A magnitude a 10-second skim can actually see: digits, or a written count
 * attached to a concrete work unit ("eight sources", "six defects"). Bare
 * written counts of abstractions ("two release cycles") don't register as
 * metrics and don't satisfy the per-entry rule.
 */
const STRONG_MAGNITUDE =
  /\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|twenty|thirty|forty|fifty)\s+(?:[a-z][a-z-]*\s+){0,2}(?:sources?|briefs?|reports?|dashboards?|rooms?|sites?|clients?|projects?|services?|tests?|cases|requests?|records?|rows|teams?|decks?|models?|workbooks?|workshops?|stakeholders?|feeds?|pipelines?|systems?|screens?|flows?|defects?|bugs|features|endpoints?|tables|schemas?|documents?|files|users?)\b/i;

/** Scope a junior engineer cannot claim without a staff engineer noticing. */
const INFLATED_SCOPE =
  /\b(?:architected|architecting|spearhead\w*|re-?platform\w*|owned the|drove the|led the (?:team|design|architecture)|single-handedly|from the ground up)\b/i;

/**
 * Number shapes that read as inflated and cannot be defended in a screen.
 * Percentages, multipliers, SLA figures, and money/user scale.
 */
const BANNED_NUMBERS = [
  { re: /\b\d+(?:\.\d+)?\s*%/, what: "an improvement percentage" },
  { re: /\b\d+(?:\.\d+)?\s*x\b/i, what: "a multiplier like 3x" },
  { re: /\b99(?:\.9+)?\s*%/, what: "an uptime/SLA figure" },
  { re: /[$£€]\s?\d/, what: "a money figure" },
  { re: /\b\d[\d,]{3,}\+?\s*(?:users?|customers?|requests?|records?|devices?|transactions?)\b/i, what: "a scale claim" },
  { re: /\b(?:millions?|billions?|thousands)\s+of\b/i, what: "a scale claim" },
];

/**
 * Proper-noun technologies only. Generic terms (API, REST, SQL, CI/CD) are not
 * what makes a bullet read as a keyword list — stacked product names are.
 */
const NAMED_TECH =
  /\b(?:python|typescript|javascript|java|kotlin|swift|golang|rust|scala|c\+\+|fastapi|django|flask|express|fastify|trpc|next\.?js|react|vue|angular|svelte|node\.?js|spring ?boot|rails|laravel|\.net|postgresql|postgres|mysql|sqlite|mongodb|redis|elasticsearch|cassandra|dynamodb|snowflake|redshift|bigquery|databricks|kafka|rabbitmq|bullmq|celery|airflow|spark|hadoop|dbt|docker|kubernetes|terraform|ansible|jenkins|github actions|gitlab ci|circleci|aws|azure|gcp|google cloud|lambda|vercel|supabase|firebase|prisma|drizzle|sqlalchemy|hibernate|pytorch|tensorflow|keras|scikit-?learn|sklearn|pandas|numpy|opencv|cuda|openai|langchain|llamaindex|hugging ?face|pinecone|weaviate|qdrant|mlflow|nginx|prometheus|grafana|datadog|splunk|selenium|cypress|playwright|jest|vitest|pytest|junit|graphql|grpc|tailwind|figma|blender)\b/gi;

/**
 * Concrete things a reader can ask a question about. Kept broad enough to cover
 * how engineers actually name their work — a first version flagged "added a RAG
 * retrieval layer" and "documented the ingestion flow" as artifact-free, which
 * spent repair calls on bullets that were already specific.
 */
const ARTIFACT =
  /\b(?:endpoint|endpoints|service|services|api|apis|queue|job|jobs|worker|workers|schema|schemas|table|tables|index|indexes|indices|query|queries|migration|migrations|pipeline|pipelines|script|scripts|report|reports|dashboard|screen|page|form|export|import|upload|webhook|cron|test|tests|fixture|fixtures|suite|build|deploy|deployment|release|runbook|design doc|ticket|flag|cache|parser|adapter|module|component|integration|checklist|log|logs|alert|config|handler|route|middleware|repository|branch|pull request|readme|documentation|layer|flow|contract|contracts|classifier|reranker|scheduler|validator|citation|citations|payload|payloads|column|columns|constraint|constraints)\b/i;

/** Consulting CAR artifacts — a model/deck/recommendation OR a real classroom/lab restore. */
const CONSULTING_ARTIFACT =
  /\b(?:model|models|spreadsheet|workbook|deck|slide|slides|briefing|brief|memo|recommendation|recommendations|recommended|workstream|analysis|analyzed|forecast|sizing|cohort|interview|interviews|kpi|kpis|hypothesis|variance|walkthrough|stakeholder|stakeholders|excel|sql|powerpoint|microsoft word|\bword\b|tracker|notices?|guides?|pivot|vlookup|xlookup|index\s*\/\s*match|power query|sumifs?|countifs?|classroom|classrooms|projector|audio|camera|lab|labs|hyflex|peripheral|display|login|advising|onboarding|orientation|secondary|dashboard|insights?|market|competitor|landscape|synthesis|sources?|python|pipeline|refresh|automat\w*|workshop|discovery|requirements?|uat|test scripts?|acceptance|process(?:es|[- ]gap| map| mapping| notes?)?|handoff|cutover|sso|identity|desk research|market research|deliverable|presentation|incident(?:s)?|diagnostic notes?|restore steps?|faculty|escalat\w*|queues?|correction plan|implementation recommendation|timing tests?|processing options|acceptance criteria)\b/i;

/** Data/ops analyst nouns — the things a bank or ops-team screener actually asks about. */
const ANALYST_ARTIFACT =
  /\b(?:records?|fields?|dataset|data set|spreadsheet|validation checks?|checks|reconciliation|entries|database|summary|summaries|identifiers?|mismatch\w*|duplicates?)\b/i;

/** Software internals a consulting/CI screener cannot use as a case story. */
const SWE_INTERNALS =
  /\b(?:payloads?|authentication|error-handling|execution plans?|deployment checklist|api fields?|processing logs?|backend workflows?|extraction workflows?|extraction delays?|service handoffs?|user-facing needs|sprint planning|mobile and web|third-party data|shared backend|user-facing requests|feature behaviour|backend defects?|backend rules?|release defects?|community-facing|infrastructure tradeoffs?|confluence|operating approach|lower-risk operating)\b/i;

/** Extra SWE phrasing banned on HR-tech / techno-functional consulting resumes. */
const HR_TECH_SWE_INTERNALS =
  /\b(?:rest api data|api (?:fields?|handoffs?)|data handoffs?|release regressions?|third-party integration|backend workflows?|extraction workflows?)\b/i;

/**
 * Workspace/vendor tools this candidate has not verified — inventing them is a tell.
 * One of three lists that must stay aligned: this one audits generated output,
 * `BUSINESS_NEVER_INVENT` in analyst-techniques.ts steers the model + assembly,
 * and `BUSINESS_VENDOR_DROP` in match.ts keeps them out of ATS scoring/boost.
 * Edit all three together.
 */
const BUSINESS_INVENTED_TOOLS =
  /\b(?:confluence|notion|airtable|miro|asana|monday\.com|pitchbook|cb insights|tableau|power bi|powerbi|qualtrics|iqvia|salesforce|alteryx|looker|spss|successfactors|workday|confirmit|\bSAS\b|\bVBA\b|visual basic|microsoft access|\bvisio\b|microsoft project|\bhadoop\b)\b/i;

/** A result is a state change: something stopped, dropped, or went away. */
const RESULT_SIGNAL =
  /\b(?:stopped|no longer|eliminat\w+|removed|cut|down to|dropped from|reduced|from \d+[^.]* to \d+|unblock\w+|without manual|by hand|automatic\w*|instead of manually|freed|caught|prevent\w+ the|surfac\w+|replac\w+|restor\w+|resolved)\b/i;

/** Evidence other humans existed: the slot that makes an entry read like a job. */
const TEAM_SIGNAL =
  /\b(?:code review|reviewed?|review ?gate|pair\w*|sprint|standup|stand-up|demo|retro|design doc|runbook|documented|documentation|handed off|handoff|onboard\w*|stakeholder|ops lead|product manager|senior (?:engineer|developer)|teammate|another developer|on-?call|support ticket|walked .* through|walkthroughs?|cross-functional|jira|staff|faculty|professors?|instructors?|front desk|partners?|reviewers?|ITS|brief(?:ing)?)\b/i;

/**
 * Work that is not greenfield building. Includes the language engineers use for
 * the thing that went wrong, not just the debugging verb — "after inconsistent
 * fields broke downstream categorization" is remediation even though it never
 * says "debugged".
 */
const FIX_SIGNAL =
  /\b(?:trac\w+|debug\w*|diagnos\w+|fixed|fix|root cause|investigat\w+|migrat\w+|backfill\w*|flaky|regression|slow|timeout|timed out|timing out|reproduc\w+|patch\w*|hardened|cleaned up|refactor\w*|optimiz\w+|index\w*|broke|breaking|fail\w+|bug|defect|malformed|inconsistent|mismatch\w*|duplicate|stale|edge case|dropp\w+|missing|restor\w+|troubleshoot\w*)\b/i;

/**
 * A specific engineering mechanism — the thing a technical screener probes.
 * Deliberately excludes generic verbs ("built", "tested", "used"): the failure
 * this catches is a technology named with nothing behind it, e.g. "tested a
 * Spark transformation in GitHub Actions", which passes a keyword scan and then
 * collapses the moment someone asks how Spark was actually used.
 */
const TECHNIQUE_SIGNAL =
  /\b(?:composite index|index(?:ed|es|ing)?|partition\w*|shuffle|broadcast|window function|aggregat\w+|grouping key|join\w*|upsert\w*|batch\w*|backfill\w*|incremental|idempoten\w+|retry|backoff|connection pool\w*|cache|caching|feature flag|fixture\w*|mock\w*|transaction\w*|migration|normaliz\w+|denormaliz\w+|execution plan\w*|query plan\w*|schema\w*|contract\w*|queue\w*|worker\w*|chunk\w*|checksum|validation|validat\w+|pars\w+|serializ\w+|compress\w+|throttl\w+|rate limit\w*|pagination|materialized view|stored procedure|constraint\w*|foreign key|primary key|filtering before|before joins|streaming|dedupl\w+|fingerprint\w*)\b/i;

/**
 * Product/framework names. Repeating these across experience bullets is the
 * FastAPI-at-every-employer tell. Languages and portable work terms (python,
 * sql, rest) are excluded — those describe the work and may recur.
 */
const PRODUCT_BRAND =
  /\b(?:fastapi|django|flask|fastify|trpc|next\.?js|react|vue|angular|spring ?boot|pytorch|tensorflow|keras|langchain|llamaindex|hugging ?face|spark|prisma|drizzle|redis|bullmq|docker|kubernetes|kotlin|openai)\b/gi;

function brandsIn(text: string): string[] {
  return [...new Set((text.match(PRODUCT_BRAND) ?? []).map((t) => t.toLowerCase().replace(/\s+/g, "")))];
}

const ABSTRACT_ENDING =
  /\b(?:ensuring|keeping|allowing|enabling|so that|giving)\b[^.]*\b(?:responsive|reliab\w*|scalab\w*|maintainab\w*|consisten\w*|stabl\w*|efficien\w*|performan\w*|clean\w*|secur\w*|robust|quality|better|faster|easier)\b/i;

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * Count + deliverable with no real scene — the INNWIL "Framed 6 use cases" /
 * "7-slide PowerPoint brief" failure. A digit is not evidence.
 */
const HOLLOW_USE_CASE =
  /\b(?:framed|prioritized|mapped|translated|identified|listed|outlined|selected)\b[\s\S]{0,90}\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\b[\s\S]{0,50}\b(?:artificial intelligence\s+)?use cases?\b/i;
const HOLLOW_SLIDE_BRIEF =
  /\b(?:converted|turned|summarized|packaged|built|wrote|prepared)\b[\s\S]{0,80}\b(?:\d+|six|seven|eight|nine|ten)[- ]?(?:slide|page)\s+(?:powerpoint\s+)?(?:brief|deck|presentation)\b/i;
const HOLLOW_LLM_LIMIT =
  /\bsummariz\w+\b[\s\S]{0,70}\b(?:llm|model|language model)\s+limitations?\b/i;

function isHollowStub(b: string): boolean {
  const hit = HOLLOW_USE_CASE.test(b) || HOLLOW_SLIDE_BRIEF.test(b) || HOLLOW_LLM_LIMIT.test(b);
  if (!hit) return false;
  const rich =
    wordCount(b) >= 20 &&
    RESULT_SIGNAL.test(b) &&
    (ARTIFACT.test(b) || CONSULTING_ARTIFACT.test(b) || ANALYST_ARTIFACT.test(b) || TECHNIQUE_SIGNAL.test(b));
  return !rich;
}

/** "Verb ..., gerund-clause ..." — the shape the model repeats until every bullet matches. */
const GERUND_SKELETON = /^\w+\b[^,]{10,},\s+\w+ing\b/i;

export interface AuditOptions {
  /** Word range from bullet_count_rule; bullets outside it are flagged. */
  minWords?: number;
  maxWords?: number;
  /**
   * How many leading entries are in expanded mode. Only those are held to the
   * composition / invent rules — campus-ops are still frozen at assemble time.
   */
  expandedCount?: number;
  /** consulting = partner-style CAR; analyst = data/ops/insights screens. Neither gets SWE mechanism quotas. */
  family?: "consulting" | "analyst";
  /** Full JD — enables posting-flavor gates (e.g. competitive-intel framing). */
  jobDescription?: string;
  jobTitle?: string;
  /**
   * Master bullets by company. Used only to catch generic fallbacks (reworded
   * master lines). Inventing JD languages in experience is allowed — this does
   * not ban new tech.
   */
  sourceEntries?: { company: string; bullets: string[] }[];
}

function companyKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function auditExperienceBullets(
  entries: { company: string; title?: string; bullets: string[] }[],
  opts: AuditOptions = {}
): BulletIssue[] {
  const {
    // Floor catches useless stubs; ceiling catches essay padding. Best length
    // sits inside — hollow stubs fail even when word count looks fine.
    minWords = 14,
    maxWords = 26,
    expandedCount = 2,
    family,
    jobDescription = "",
    jobTitle = "",
    sourceEntries = [],
  } = opts;
  const sourceByCompany = new Map(
    sourceEntries.map((e) => [companyKey(e.company), e.bullets.map((b) => b.trim()).filter(Boolean)])
  );
  const consulting = family === "consulting";
  const business = consulting || family === "analyst";
  const issues: BulletIssue[] = [];
  const add = (company: string, severity: BulletIssue["severity"], message: string) =>
    issues.push({ company, severity, message });

  const CS_TITLE =
    /\b(software|developer|engineer|automation|programmer|full[- ]?stack|back[- ]?end|data automation)\b/i;
  const ANALYST_ONLY = /\banalyst\b/i;
  const postingHead = `${jobTitle}\n${jobDescription}`;
  const isCI =
    consulting &&
    /competitive intelligence|market(?:ing)? intelligence|\bcompetitive landscape\b|source monitor/i.test(postingHead);
  const isHrTech =
    business &&
    /successfactors|hr technology|hris|\bhcm\b|techno-?functional|\bworkday\b|client workshop|test scripts?|\buat\b|hr apis?|hr systems?/i.test(
      postingHead
    );
  const isZsSip =
    consulting &&
    /strategy insights|insights\s*&\s*planning|desk research|confirmit|market research and\/or desk research/i.test(postingHead);
  const isZsDa =
    consulting &&
    /decision analytics|statistical models?|\bSAS\b|\bVBA\b|visual basic|hadoop eco|design custom analyses in R/i.test(postingHead);

  entries.forEach((entry, entryIdx) => {
    const { company, bullets } = entry;
    if (!bullets.length) return;
    // Campus-ops bullets are frozen source text. Style flags on them can never
    // be repaired, so every resume that keeps HyFlex showed the same "mistake".
    const campusOps = isCampusOpsEntry({ company, title: entry.title ?? "" });
    const expanded = entryIdx < expandedCount;

    for (const b of bullets) {
      const short = b.length > 60 ? `${b.slice(0, 60)}...` : b;

      const filler = FILLER.exec(b);
      if (filler) add(company, "high", `"${short}" uses filler "${filler[0]}" — state the actual work instead`);

      const vague = VAGUE_EVIDENCE.exec(b);
      if (vague) {
        add(
          company,
          "high",
          `"${short}" is vague evidence ("${vague[0]}") — name the artifact, problem, method, and observable outcome a screener for THIS role would probe`
        );
      }

      const softStuff = SOFT_SKILL_STUFFING.exec(b);
      if (softStuff) {
        add(
          company,
          "high",
          `"${short}" pastes soft-skill label "${softStuff[0]}" into experience — put that on Professional skills; invent a real workshop, use-case, deck, or fix scene for THIS posting`
        );
      }

      if (!campusOps && isHollowStub(b)) {
        add(
          company,
          "high",
          `"${short}" is a hollow count/deliverable stub (use cases / slide brief / LLM limitations) — rewrite to a clear junior scene ATS/HR/interviewers can probe: bottleneck, what you did, who used it, what changed (best length, not padding)`
        );
      }

      const scope = INFLATED_SCOPE.exec(b);
      if (scope) {
        add(company, "high", `"${short}" claims senior scope with "${scope[0]}" — a junior engineer owns tasks, not systems`);
      }

      for (const { re, what } of BANNED_NUMBERS) {
        const m = re.exec(b);
        if (m) add(company, "high", `"${short}" contains ${what} ("${m[0]}") — indefensible in a screen; use a duration, a count, or a plain state change`);
      }

      const techNames = [...new Set((b.match(NAMED_TECH) ?? []).map((t) => t.toLowerCase()))];
      if (techNames.length > 2) {
        add(company, "high", `"${short}" names ${techNames.length} technologies (${techNames.join(", ")}) — max 2 per bullet, or it reads as a keyword list`);
      }
      // Expanded rows must be fresh scenes — not a lightly reworded master bullet
      // (Project Human City / Three of Cups "fallback resume" feel).
      if (expanded && !campusOps) {
        const source = sourceByCompany.get(companyKey(company)) ?? [];
        if (source.some((src) => bulletsTooAlike(b, src))) {
          add(
            company,
            "high",
            `"${short}" reads as a reworded master bullet — invent a fresh junior scene for THIS posting (tools from the JD are fine); do not ship a generic REST/auth/Postgres paraphrase`
          );
        }
      }
      if (business) {
        // Data/ops analyst screens value real pipeline and validation work; only partner-style consulting bans it.
        const banSwePlot =
          consulting || Boolean(jobDescription && !jdWantsProgramming(jobDescription, jobTitle));
        const leak = banSwePlot ? SWE_INTERNALS.exec(b) || (isHrTech ? HR_TECH_SWE_INTERNALS.exec(b) : null) : null;
        if (leak) {
          add(
            company,
            "high",
            isHrTech
              ? `"${short}" is SWE/integration implementation language ("${leak[0]}") — rewrite as workshop, requirements, process clarification, or UAT/acceptance`
              : `"${short}" is software-implementation language ("${leak[0]}") — a consulting/CI screener cannot see the business problem; rewrite as diagnosis, analysis, recommendation`
          );
        }
        const invented = BUSINESS_INVENTED_TOOLS.exec(b);
        if (invented) {
          add(
            company,
            "high",
            `"${short}" invents "${invented[0]}" — not in the verified tool pool; map to an intern-defensible method or drop the product name`
          );
        }
      }

      // A bullet naming a technology should carry a mechanism, an outcome, or be
      // about working with people (where the collaboration IS the substance and
      // re-explaining the mechanism would bloat it). Depth is enforced at entry
      // level below; here it is only advisory, because a per-bullet hard rule
      // forces every line into mechanism-speak and stops the entry reading like
      // a real job.
      if (techNames.length > 0 && !TECHNIQUE_SIGNAL.test(b) && !business) {
        const excused = RESULT_SIGNAL.test(b) || /\d/.test(b) || TEAM_SIGNAL.test(b);
        add(
          company,
          excused ? "low" : "high",
          `"${short}" name-drops ${techNames.join(", ")} with no technique and no outcome — say HOW it was used (an index, a partition, a retry, a fixture) or what changed`
        );
      }

      if (!(ARTIFACT.test(b) || (business && CONSULTING_ARTIFACT.test(b)) || (family === "analyst" && ANALYST_ARTIFACT.test(b)))) {
        add(
          company,
          "high",
          consulting
            ? `"${short}" names no concrete analysis artifact (Excel model, deck, recommendation, workshop, requirements note, UAT script, process map) — nothing a partner can ask about`
            : business
              ? `"${short}" names nothing concrete (the dataset, query, script, validation check, tracker, or report) — nothing a hiring manager can ask about`
              : `"${short}" names no concrete artifact (endpoint, job, schema, migration, test, report) — nothing here a recruiter can ask about`
        );
      }

      if (!campusOps && ABSTRACT_ENDING.test(b)) {
        add(company, "high", `"${short}" ends on an unfalsifiable quality claim — replace with a real state change or drop the tail`);
      }

      const w = wordCount(b);
      // Under-floor = useless stub. Over-ceiling = padding (low). Hollow stubs
      // are caught above even when length is inside the band.
      if (expanded && !campusOps && w < minWords) {
        add(company, "high", `"${short}" is only ${w} words (best band ${minWords}-${maxWords}) — too thin for ATS/HR/interview; rewrite as a clear scene, not a longer fluff line`);
      } else if (!campusOps && w < Math.max(10, minWords - 3)) {
        add(company, "high", `"${short}" is only ${w} words — it reads as nothing left to say; rewrite the scene`);
      } else if (w < minWords || w > maxWords) {
        add(company, "low", `"${short}" is ${w} words (best band ${minWords}-${maxWords})`);
      }
    }

    if (business && expanded && bullets.length > 0 && bullets.length < 3) {
      add(company, "high", `this entry has ${bullets.length} bullets — consulting needs 3 CAR bullets, not a compressed stub`);
    }

    // ---- entry-level composition: does this read like a job? ----
    if (expanded && bullets.length >= 2) {
      if (!bullets.some((b) => RESULT_SIGNAL.test(b) || HAS_MAGNITUDE.test(b))) {
        add(company, "high", `no bullet in this entry states what changed — at least one needs a concrete result (a step removed, an error that stopped, a duration that dropped)`);
      }
      // Expanded software/analysis entries need TWO visible metrics (2 of 3).
      // Parsers store the digit inside the bullet; they do not score how many
      // there are (Textkernel, RChilli, Daxtra). Reyt et al. 2016: concreteness
      // raised entry-level interview invites. Zhang & Schwarz 2012/2013:
      // uneven quantities read as measured; a precise number on every line
      // reads as automated and loses that advantage. Campus-ops stay on real
      // source counts.
      const magCount = bullets.filter((b) => STRONG_MAGNITUDE.test(b)).length;
      const magFloor = campusOps ? 1 : 2;
      if (magCount < magFloor) {
        add(
          company,
          "high",
          campusOps
            ? `no bullet in this entry carries a visible metric — campus-ops uses a real source count (30+ rooms, 20+ requests, 8-12 students)`
            : magCount === 0
              ? `no bullet in this entry carries a visible metric — put a junior-scope number on TWO of the THREE bullets (duration, count, rows, hours, sites, sources); written-out counts of abstractions don't register on a skim`
              : `this entry has only ${magCount} visible metric — a second of the three bullets needs a junior-scope number (duration, count, rows, hours, sites, sources); never two numbers in one bullet, never quantify every clause`
        );
      }
      if (!bullets.some((b) => TEAM_SIGNAL.test(b))) {
        add(
          company,
          "high",
          business
            ? `no bullet in this entry shows other people — add a stakeholder walkthrough, a handoff, or a recommendation someone used`
            : `no bullet in this entry shows other people — add one that involves code review, a sprint demo, a runbook someone used, or a stakeholder request`
        );
      }
      // Technical depth, measured across the entry rather than per bullet. An
      // entry where only one line of three shows a real mechanism reads as
      // keyword-shaped to a staff engineer even when every bullet passes on its
      // own: the technologies are all present, the engineering is not.
      const withTechnique = bullets.filter((b) => TECHNIQUE_SIGNAL.test(b)).length;
      if (!business && bullets.length >= 3 && withTechnique * 2 < bullets.length) {
        add(
          company,
          "high",
          `only ${withTechnique} of ${bullets.length} bullets in this entry show a real mechanism — a technical screener reads the rest as keywords; name the index, partition, grouping key, retry, fixture or contract that made the work work`
        );
      }
      if (business) {
        const diagnose = /\b(?:found|mismatch|reconcil\w*|gap|variance|diagnos\w+|traced|investigat\w+|noticed|caught|corrected|issues?|unclear|resolv\w*)\b/i;
        if (!bullets.some((b) => diagnose.test(b) || FIX_SIGNAL.test(b))) {
          add(
            company,
            "high",
            consulting
              ? `no bullet in this entry diagnoses a problem — consulting screens for "did you diagnose something, not just execute"`
              : `no bullet in this entry finds a problem — analyst screens want the error, duplicate, mismatch, or slow manual step you caught and what you did about it`
          );
        }
        const hyflex = /\bITS\b/i.test(company) || /hyflex/i.test(company);
        if (hyflex) {
          const TECH_FIX =
            /\b(?:restor\w+|resolved|troubleshoot\w*|fixed|reconnected|reconfigured|reimaged|installed|configured|got (?:the )?(?:class|lecture|lab|room))\b/i;
          const DOC_ONLY = /\b(?:documented|documentation|rewrote|procedures|notices|guide|guides|tracker)\b/i;
          if (!bullets.some((b) => TECH_FIX.test(b))) {
            add(
              company,
              "high",
              `HyFlex reads as documentation — write that you restored classroom or lab tech for a professor (audio, display, camera, login); docs are at most one later bullet`
            );
          }
          const docsOnly = bullets.filter((b) => DOC_ONLY.test(b) && !TECH_FIX.test(b)).length;
          if (docsOnly >= 2) {
            add(
              company,
              "high",
              `HyFlex has ${docsOnly} documentation-only bullets — at most one; the job was front-line troubleshooting for professors and labs`
            );
          }
        }
      } else if (!bullets.some((b) => FIX_SIGNAL.test(b))) {
        add(company, "high", `every bullet in this entry is greenfield building — real jobs include tracing a bug, cutting a slow query, or a migration`);
      }

      const openings = bullets.map(firstWord);
      const dupes = openings.filter((v, i) => v && openings.indexOf(v) !== i);
      if (dupes.length) {
        add(company, "low", `bullets repeat the opening verb "${dupes[0]}" — vary the verb and the sentence shape`);
      }
      const gerunds = bullets.filter((b) => GERUND_SKELETON.test(b)).length;
      if (bullets.length >= 3 && gerunds >= bullets.length - 1) {
        add(company, "low", `${gerunds} of ${bullets.length} bullets use the same "verb..., -ing clause" skeleton — identical rhythm is a machine-written tell`);
      }
    }
  });

  // ---- resume-wide checks ----
  const expanded = entries.slice(0, expandedCount);
  const expandedBullets = expanded.flatMap((e) => e.bullets);

  // At least one magnitude somewhere. Qualitative results satisfy the per-entry
  // rule, and a resume can end up with zero numbers on the whole page — which is
  // the weakest possible showing on a 10-second scan and to an exec reader.
  if (expandedBullets.length > 0 && !expandedBullets.some((b) => HAS_MAGNITUDE.test(b))) {
    add(
      expanded[0].company,
      "high",
      `not one bullet on the resume carries a number — give at least one a magnitude (a duration, a row/record count, a team size); qualitative results alone read soft on a 10-second scan`
    );
  }

  // A product name in two or more experience bullets is the FastAPI-everywhere
  // tell. Skills and projects may repeat it; experience may not.
  const brandHits = new Map<string, number>();
  for (const b of entries.flatMap((e) => e.bullets)) {
    for (const brand of brandsIn(b)) brandHits.set(brand, (brandHits.get(brand) ?? 0) + 1);
  }
  for (const [brand, n] of brandHits) {
    if (n >= 2) {
      add(
        expanded[0]?.company ?? entries[0].company,
        "high",
        `"${brand}" appears in ${n} experience bullets — name a product at most once in experience and use a portable term (REST API, pipeline, SQL) elsewhere`
      );
    }
  }

  // Verbatim reuse of an unusual phrase across bullets is a template tell, and
  // the per-bullet checks cannot see it.
  const allBullets = entries.flatMap((e) => e.bullets);
  const seen = new Map<string, number>();
  for (const b of allBullets) {
    const words = b.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    const local = new Set<string>();
    for (let i = 0; i + 3 <= words.length; i++) local.add(words.slice(i, i + 3).join(" "));
    for (const ph of local) seen.set(ph, (seen.get(ph) ?? 0) + 1);
  }
  const repeated = [...seen]
    .filter(([ph, n]) => n > 1 && !/^(?:the|a|an|and|of|to|in|for|with|then|after|into|that|from) /.test(ph))
    .map(([ph]) => ph);
  if (repeated.length > 0) {
    add(entries[0].company, "low", `phrase reused verbatim across bullets: "${repeated[0]}" — vary the wording`);
  }

  if (business) {
    // Safety net if a short fixture skipped per-entry floors: at least two
    // magnitudes on the page, and HyFlex's 30+ cannot be the only one.
    const withNum = allBullets.filter((b) => HAS_MAGNITUDE.test(b));
    const nonHyflexNum = withNum.filter(
      (b) => !(/30\+|thirty/i.test(b) && /room|hyflex|faculty|classroom|instruction/i.test(b))
    );
    if (withNum.length < 2 || nonHyflexNum.length < 1) {
      add(
        entries[0].company,
        "high",
        `consulting/analyst needs TWO numbered bullets per expanded software/analysis entry — HyFlex's 30+ rooms is a campus-ops source count, not a substitute for INNWIL/PHC magnitudes (sources, briefs, sites, hours, cycle time)`
      );
    }

    if (isCI) {
      const ciSignal =
        /\b(?:source|sources|landscape|competitor|competitive|synthesis|synthesiz\w*|brief|monitor\w*|incomplete|fragment\w*|secondary|market signal|intelligence input)\b/i;
      const ciHits = allBullets.filter((b) => ciSignal.test(b)).length;
      if (ciHits < 2) {
        add(
          entries[0].company,
          "high",
          `competitive-intelligence posting needs at least two bullets with source monitoring / landscape / synthesis / brief framing mapped from real work`
        );
      }
    }

    if (isHrTech) {
      const hrSignal =
        /\b(?:workshop|discovery|requirements?|process(?:es| gap| gaps| map| mapping| notes?)?|test scripts?|uat|acceptance|handoff|walkthrough|sso|identity|stakeholder|onboarding|hr process)\b/i;
      const hrHits = allBullets.filter((b) => hrSignal.test(b)).length;
      if (hrHits < 2) {
        add(
          entries[0].company,
          "high",
          `HR-tech / techno-functional posting needs at least two bullets with workshop / requirements / process / UAT / acceptance / handoff framing`
        );
      }
    }

    if (isZsSip) {
      const sipSignal =
        /\b(?:desk research|market research|secondary|insight|insights|synthesis|synthesiz\w*|recommendation|brief|framework|client|stakeholder|excel|sources?)\b/i;
      const sipHits = allBullets.filter((b) => sipSignal.test(b)).length;
      if (sipHits < 2) {
        add(
          entries[0].company,
          "high",
          `ZS Strategy Insights posting needs at least two bullets with desk/market research / insight synthesis / client recommendation framing`
        );
      }
    }

    if (isZsDa) {
      const daSignal =
        /\b(?:analysis|analyses|model|excel|sql|python|dashboard|recommendation|brief|presentation|client|stakeholder|quantitativ\w*|decision)\b/i;
      const daHits = allBullets.filter((b) => daSignal.test(b)).length;
      if (daHits < 2) {
        add(
          entries[0].company,
          "high",
          `ZS Decision Analytics posting needs at least two bullets with quantitative analysis / Excel-SQL-Python method / client decision framing`
        );
      }
    }

    const TEMPLATES: { re: RegExp; name: string }[] = [
      { re: /faculty notices/i, name: "faculty notices" },
      { re: /paper logs? dropped follow-ups/i, name: "paper logs dropped follow-ups" },
      { re: /reusable (?:answers?|guide|one-page)/i, name: "reusable answers/guide" },
      { re: /internal extraction workflows/i, name: "internal extraction workflows" },
      { re: /mobile and web/i, name: "mobile and web" },
      { re: /third-party data/i, name: "third-party data" },
    ];
    for (const t of TEMPLATES) {
      const hits = allBullets.filter((b) => t.re.test(b)).length;
      if (hits >= 2 || (consulting && hits >= 1 && (t.name === "mobile and web" || t.name === "third-party data"))) {
        add(
          entries[0].company,
          "high",
          hits >= 2
            ? `the phrase "${t.name}" is reused on ${hits} bullets — HyFlex, Office Assistant, and internships must tell different stories`
            : `"${t.name}" is product/SWE template language on a consulting/CI resume — rewrite as source synthesis or stakeholder analysis`
        );
      }
    }
    const officeStamp = (b: string) =>
      /\bexcel\b/i.test(b) || /\bpowerpoint\b/i.test(b) || /\bmicrosoft word\b/i.test(b) || /\bin word\b/i.test(b);
    const stamped = allBullets.filter(officeStamp).length;
    if (stamped >= 3) {
      add(
        entries[0].company,
        "high",
        `Excel/Word/PowerPoint is stamped on ${stamped} experience bullets — put product names in skills and write the actual work instead`
      );
    }
    // Engineer/CS title gate, when titles are present (generate path).
    // Bullet-only unit fixtures omit titles and skip this gate.
    // The CS bridge is conditional: it belongs on the page ONLY when the
    // posting asks for programming. A no-coding posting (classic Bain/McKinsey
    // strategy Associate) gets an all-Analyst page. Fixtures without a JD keep
    // the legacy bridge-required behavior.
    const titled = entries.some((e) => typeof e.title === "string" && e.title.trim().length > 0);
    const wantsProgramming = jobDescription ? jdWantsProgramming(jobDescription, jobTitle) : true;
    if (titled) {
      const engineerTitled = entries.filter(
        (e) => e.title && CS_TITLE.test(e.title) && !ANALYST_ONLY.test(e.title)
      );
      if (isHrTech) {
        if (engineerTitled.length > 0) {
          add(
            engineerTitled[0].company,
            "high",
            `HR systems page still has engineering title "${engineerTitled[0].title}" — use Systems Analyst / HR Technology Analyst so the 8-second skim matches the posting`
          );
        }
      } else if (!wantsProgramming) {
        if (engineerTitled.length > 0) {
          add(
            engineerTitled[0].company,
            "high",
            `posting names no programming/coding requirement — keep ZERO engineering titles; reword "${engineerTitled[0].title}" toward an Analyst-family title that fits this posting (an engineer title on a no-coding posting reads as a mismatch)`
          );
        }
      } else if (engineerTitled.length === 0) {
        add(
          entries[0].company,
          "high",
          "no engineer/CS-titled software entry — keep exactly one CS bridge (Software Engineer Intern / Data Automation Engineer) with JD-balanced automation + stakeholder bullets"
        );
      } else if (engineerTitled.length > 1) {
        add(
          engineerTitled[1].company,
          "high",
          `${engineerTitled.length} engineer/CS titles on the page — keep exactly one CS bridge; reword the others to Analyst / Insights Analyst`
        );
      } else {
        const bridge = engineerTitled[0];
        const techish = bridge.bullets.filter((b) =>
          /\b(?:python|sql|pipeline|automat\w*|refresh|script|query|join|dashboard)\b/i.test(b)
        ).length;
        const businessish = bridge.bullets.filter((b) =>
          /\b(?:stakeholders?|recommend\w*|brief|synthesis|decision|insight|landscape|competitor|walkthrough|walked|handoff|handed|partners?|operations|reviewers?|team ?lead)\b/i.test(
            b
          )
        ).length;
        // Tool-silent MBB: stakeholder/judgment is enough. Technical JD / CI: need both.
        const wantsTech =
          /\b(?:python|sql|pipeline|automat|workflow|source monitor|refresh)\b/i.test(postingHead) || isCI;
        if (businessish === 0 || (wantsTech && techish === 0)) {
          add(
            bridge.company,
            "high",
            wantsTech
              ? `CS bridge "${bridge.title}" is unbalanced — need at least one automation/data bullet AND one stakeholder/synthesis bullet weighted to THIS posting`
              : `CS bridge "${bridge.title}" needs stakeholder/synthesis evidence — on a tool-silent posting do not force Python/SQL filler`
          );
        }
      }
    }
  }

  return issues;
}

/**
 * A first project bullet that explains the PRODUCT, not the stack.
 * Implementation verbs + pipeline/schema/endpoint in the opening is the failure
 * mode this exists to catch — a 10-second scanner never learns what was built.
 */
const PRODUCT_PURPOSE =
  /\b(?:platform|product|app|application|workspace|tool that|turns |lets |helps |journal|exam[- ]prep|learning|wellness|budget\w*|dashboard|collaborat\w*|cleanup|aggregat\w*|job[- ]search|3d|spatial|postings?|students?|teams?|files?|users?|companion|practice|flashcards?|mood|expenses?|assets?|viewer|tracker)\b/i;
const IMPLEMENTATION_LEAD =
  /^(?:built|engineered|implemented|designed|added|wired|modeled|defined|shipped)\b[\s\S]{0,80}\b(?:pipeline|schema|endpoint|api|service|queue|worker|constraint)\b/i;

export function auditProjectBullets(
  projects: { id?: string; bullets: string[] }[],
  opts: { family?: "consulting" | "analyst" } = {}
): BulletIssue[] {
  const consulting = opts.family === "consulting" || opts.family === "analyst";
  const issues: BulletIssue[] = [];
  const add = (name: string, severity: BulletIssue["severity"], message: string) =>
    issues.push({ company: name, severity, message });

  for (const p of projects) {
    const name = p.id || "project";
    const bullets = (p.bullets ?? []).filter(Boolean);
    if (bullets.length < 2) {
      add(name, "high", `only ${bullets.length} bullet(s) — projects need exactly 2: what it is, then how it was built`);
      continue;
    }
    const [purpose, how] = bullets;
    if (bulletsTooAlike(purpose, how)) {
      add(
        name,
        "high",
        `bullet 2 repeats bullet 1 — the second line has to add a new fact (status history, the duplicate check, the chart), not rephrase the product`
      );
    }
    const purposeShort = purpose.length > 60 ? `${purpose.slice(0, 60)}...` : purpose;
    const howShort = how.length > 60 ? `${how.slice(0, 60)}...` : how;

    if (IMPLEMENTATION_LEAD.test(purpose)) {
      add(
        name,
        "high",
        `bullet 1 ("${purposeShort}") opens on implementation — rewrite as what the product is, who it is for, and why it is valuable`
      );
    } else if (!PRODUCT_PURPOSE.test(purpose)) {
      add(
        name,
        "high",
        `bullet 1 ("${purposeShort}") never says what the product is — a 10-second scanner will skip it`
      );
    }
    const purposeTech = [...new Set((purpose.match(NAMED_TECH) ?? []).map((t) => t.toLowerCase()))];
    if (purposeTech.length > 1) {
      add(name, "high", `bullet 1 names ${purposeTech.length} technologies (${purposeTech.join(", ")}) — purpose bullets carry at most one`);
    }

    const howTech = [...new Set((how.match(NAMED_TECH) ?? []).map((t) => t.toLowerCase()))];
    if (howTech.length === 0 && !consulting) {
      add(name, "high", `bullet 2 ("${howShort}") names no technology — this is the implementation line`);
    } else if (howTech.length > 2) {
      add(name, "high", `bullet 2 names ${howTech.length} technologies (${howTech.join(", ")}) — max 2, or it reads as a keyword list`);
    }
    if (!consulting && !TECHNIQUE_SIGNAL.test(how)) {
      add(
        name,
        "high",
        `bullet 2 ("${howShort}") lists tech with no technique — name the index, worker, scheduler, or constraint that made the feature work`
      );
    }
    if (consulting && !(CONSULTING_ARTIFACT.test(how) || TECHNIQUE_SIGNAL.test(how) || howTech.length > 0)) {
      add(
        name,
        "high",
        `bullet 2 ("${howShort}") never states how the product produces an insight or decision — name the analysis or the distinctive feature`
      );
    }
    if (consulting && /tailored resume|latex resume|generates? (?:a )?tailored|llm[- ]generated/i.test(bullets.join(" "))) {
      add(
        name,
        "high",
        `business-page project mentions generating tailored resumes — rewrite as the tracker, status data, and follow-up loop (campus/HR recruiters read resume-generation as application spam)`
      );
    }
  }
  return issues;
}

/** Feedback block for the repair pass. Specific failures only — generic scolding changes nothing. */
const ANALYST_COMPOSE =
  "Do not simply reword the flagged bullets. Recompose from source facts + THIS posting + hiring_screen. YOU MAY INVENT junior-defensible scenes (Python checks, LLM prompt tests, extraction samples, review checklists, timed comparisons). Ban hollow 'N use cases' / 'N-slide PowerPoint brief' / bare 'LLM limitations' stubs. Best length 14-24 words: clear enough for ATS/HR/interview, never padded fluff, never useless short. Analyst screeners want: data/AI problem -> method YOU used -> what changed. Write like the Student Services tracker: artifact + who used it + what stopped. Do NOT translate software into fog. Three bullets per entry; TWO of THREE carry one junior-scope number. Campus-ops keep source counts. Put claimable must-haves in skills. Projects: what it is, then how it helps. JobHub is a tracker, never a resume generator.";

export function qualityFeedback(issues: BulletIssue[], family?: "consulting" | "analyst"): string {
  const high = issues.filter((i) => i.severity === "high");
  const low = issues.filter((i) => i.severity === "low");
  const lines = [...high, ...low].map((i) => `- [${i.company}] ${i.message}`);
  const compose =
    family === "analyst"
      ? ANALYST_COMPOSE
      : family === "consulting"
      ? "Do not simply reword the flagged bullets. Recompose from source facts + THIS posting + hiring_screen/reddit intel + posting_flavor + jd_deep_analysis_protocol. YOU MAY INVENT junior CAR scenes — ban hollow 'N use cases' / 'N-slide PowerPoint brief' / bare 'LLM limitations' stubs. Best length 14-24 words (clear for ATS/HR/interview; do not pad). CAR, THREE bullets per entry. AT MOST ONE engineer/CS title when the posting asks for programming; else ZERO engineering titles. HR-tech: Systems Analyst / HR Technology Analyst only. Other rows: Analyst language (Insights/Strategy when zs-sip; Analytics when zs-da). Invent methods for THIS posting — no Pivot/INDEX-MATCH stamp. CI: source monitoring / synthesis / brief. HR-tech: workshop / requirements / UAT. ZS SIP/DA: research or quant → recommendation. Never invent IQVIA/Tableau/Qualtrics/PitchBook/CRM/Confluence/SuccessFactors/Workday/Confirmit. Ban vague tails. Artifact + who used it + what changed. Campus-ops stay source. TWO numbered bullets per expanded entry. No FastAPI/REST-handoff repairs. Projects: problem then insight. JobHub is a tracker. Never Windows Booster."
      : "Do not simply reword the flagged bullets. Recompose BOTH expanded software entries as junior scenes for THIS posting — invent freely when the JD asks. Best length 14-24 words: clear for ATS/HR/interview, not essay-long, not hollow. Ban 'N use cases' / 'N-slide PowerPoint brief' with no method or result. Each entry: one build, one fix, one team beat; concrete artifacts; at most two named technologies per bullet; TWO numbered bullets (2 of 3). Projects: what it is, then distinctive feature + tech + technique.";
  return [
    "QUALITY REPAIR PASS. Your previous draft failed these specific checks. Rewrite the flagged experience and project bullets from scratch to fix every one of them while following all original rules (bullet_count_rule still governs experience count and length; projects stay at exactly 2 bullets — purpose, then implementation):",
    ...lines,
    compose,
  ].join("\n");
}

/** High-severity count — the route's trigger for spending another LLM call. */
export function highSeverityCount(issues: BulletIssue[]): number {
  return issues.filter((i) => i.severity === "high").length;
}

/**
 * Indefensible number shapes anywhere in the given text.
 *
 * Expanded mode authorizes invented durations and counts, so "a number absent
 * from the source material" is no longer sufficient grounds to regenerate — that
 * would retry on every legitimate outcome. Only these shapes are disqualifying,
 * because they imply measurement the candidate never owned.
 */
export function bannedNumberShapes(texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    for (const { re, what } of BANNED_NUMBERS) {
      const m = re.exec(t);
      if (m) found.add(`${m[0].trim()} (${what})`);
    }
  }
  return [...found];
}

/**
 * Requirement-coverage issues: the posting's must-have requirements that the
 * assembled resume never addresses. The style audit above cannot see these —
 * a resume can pass every doctrine check while silently skipping the posting's
 * #1 requirement. Fed into the same repair pass as style failures.
 */
export function coverageIssues(uncoveredMustHaves: string[], company: string): BulletIssue[] {
  return uncoveredMustHaves.slice(0, 5).map((t) => ({
    company,
    severity: "high" as const,
    message: `the posting's must-have requirement "${t}" is not addressed anywhere — put its standard skill name in the skills section (that is what the ATS reads); mention it in a bullet only if it names real work, in your own words — never paste the posting's phrasing into a bullet`,
  }));
}
