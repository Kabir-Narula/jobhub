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

export interface BulletIssue {
  company: string;
  severity: "high" | "low";
  message: string;
}

/** Filler that says nothing — the classic vague-bullet opener. */
const FILLER =
  /\b(?:worked on|helped (?:with|to)|assisted (?:with|in)|was responsible for|responsible for|involved in|participated in|contributed to|various|multiple|successfully|utiliz\w+|leverag\w+|as needed|among others|etc\.)\b/i;

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

/** A result is a state change: something stopped, dropped, or went away. */
const RESULT_SIGNAL =
  /\b(?:stopped|no longer|eliminat\w+|removed|cut|down to|dropped from|reduced|from \d+[^.]* to \d+|unblock\w+|without manual|by hand|automatic\w*|instead of manually|freed|caught|prevent\w+ the|surfac\w+|replac\w+)\b/i;

/** Evidence other humans existed: the slot that makes an entry read like a job. */
const TEAM_SIGNAL =
  /\b(?:code review|reviewed?|review ?gate|pair\w*|sprint|standup|stand-up|demo|retro|design doc|runbook|documented|documentation|handed off|handoff|onboard\w*|stakeholder|ops lead|product manager|senior (?:engineer|developer)|teammate|another developer|on-?call|support ticket|walked .* through|confluence|jira)\b/i;

/**
 * Work that is not greenfield building. Includes the language engineers use for
 * the thing that went wrong, not just the debugging verb — "after inconsistent
 * fields broke downstream categorization" is remediation even though it never
 * says "debugged".
 */
const FIX_SIGNAL =
  /\b(?:trac\w+|debug\w*|diagnos\w+|fixed|fix|root cause|investigat\w+|migrat\w+|backfill\w*|flaky|regression|slow|timeout|timed out|timing out|reproduc\w+|patch\w*|hardened|cleaned up|refactor\w*|optimiz\w+|index\w*|broke|breaking|fail\w+|bug|defect|malformed|inconsistent|mismatch\w*|duplicate|stale|edge case|dropp\w+|missing)\b/i;

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

/** "Verb ..., gerund-clause ..." — the shape the model repeats until every bullet matches. */
const GERUND_SKELETON = /^\w+\b[^,]{10,},\s+\w+ing\b/i;

export interface AuditOptions {
  /** Word range from bullet_count_rule; bullets outside it are flagged. */
  minWords?: number;
  maxWords?: number;
  /**
   * How many leading entries are in expanded mode. Only those are held to the
   * composition rules — the trailing anchor entry stays verbatim-true and is
   * allowed to be a plain, unembellished account.
   */
  expandedCount?: number;
}

export function auditExperienceBullets(
  entries: { company: string; bullets: string[] }[],
  opts: AuditOptions = {}
): BulletIssue[] {
  const { minWords = 14, maxWords = 28, expandedCount = 2 } = opts;
  const issues: BulletIssue[] = [];
  const add = (company: string, severity: BulletIssue["severity"], message: string) =>
    issues.push({ company, severity, message });

  entries.forEach((entry, entryIdx) => {
    const { company, bullets } = entry;
    if (!bullets.length) return;
    const expanded = entryIdx < expandedCount;

    for (const b of bullets) {
      const short = b.length > 60 ? `${b.slice(0, 60)}...` : b;

      const filler = FILLER.exec(b);
      if (filler) add(company, "high", `"${short}" uses filler "${filler[0]}" — state the actual work instead`);

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

      // A bullet naming a technology should carry a mechanism, an outcome, or be
      // about working with people (where the collaboration IS the substance and
      // re-explaining the mechanism would bloat it). Depth is enforced at entry
      // level below; here it is only advisory, because a per-bullet hard rule
      // forces every line into mechanism-speak and stops the entry reading like
      // a real job.
      if (techNames.length > 0 && !TECHNIQUE_SIGNAL.test(b)) {
        const excused = RESULT_SIGNAL.test(b) || /\d/.test(b) || TEAM_SIGNAL.test(b);
        add(
          company,
          excused ? "low" : "high",
          `"${short}" name-drops ${techNames.join(", ")} with no technique and no outcome — say HOW it was used (an index, a partition, a retry, a fixture) or what changed`
        );
      }

      if (!ARTIFACT.test(b)) {
        add(company, "high", `"${short}" names no concrete artifact (endpoint, job, schema, migration, test, report) — nothing here a recruiter can ask about`);
      }

      if (ABSTRACT_ENDING.test(b)) {
        add(company, "high", `"${short}" ends on an unfalsifiable quality claim — replace with a real state change or drop the tail`);
      }

      const w = wordCount(b);
      if (w < minWords - 4) {
        // A stub next to full-length neighbours looks like the writer ran out of
        // things to say about that job — visible at a glance, unlike a word or
        // two of drift.
        add(company, "high", `"${short}" is only ${w} words next to full-length bullets (target ${minWords}-${maxWords}) — it reads as nothing left to say`);
      } else if (w < minWords || w > maxWords) {
        add(company, "low", `"${short}" is ${w} words (target ${minWords}-${maxWords})`);
      }
    }

    // ---- entry-level composition: does this read like a job? ----
    if (expanded && bullets.length >= 2) {
      if (!bullets.some((b) => RESULT_SIGNAL.test(b) || /\d/.test(b))) {
        add(company, "high", `no bullet in this entry states what changed — at least one needs a concrete result (a step removed, an error that stopped, a duration that dropped)`);
      }
      if (!bullets.some((b) => TEAM_SIGNAL.test(b))) {
        add(company, "high", `no bullet in this entry shows other people — add one that involves code review, a sprint demo, a runbook someone used, or a stakeholder request`);
      }
      // Technical depth, measured across the entry rather than per bullet. An
      // entry where only one line of three shows a real mechanism reads as
      // keyword-shaped to a staff engineer even when every bullet passes on its
      // own: the technologies are all present, the engineering is not.
      const withTechnique = bullets.filter((b) => TECHNIQUE_SIGNAL.test(b)).length;
      if (bullets.length >= 3 && withTechnique * 2 < bullets.length) {
        add(
          company,
          "high",
          `only ${withTechnique} of ${bullets.length} bullets in this entry show a real mechanism — a technical screener reads the rest as keywords; name the index, partition, grouping key, retry, fixture or contract that made the work work`
        );
      }
      if (!bullets.some((b) => FIX_SIGNAL.test(b))) {
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
  if (expandedBullets.length > 0 && !expandedBullets.some((b) => /\d/.test(b))) {
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

  return issues;
}

/**
 * A first project bullet that explains the PRODUCT, not the stack.
 * Implementation verbs + pipeline/schema/endpoint in the opening is the failure
 * mode this exists to catch — a 10-second scanner never learns what was built.
 */
const PRODUCT_PURPOSE =
  /\b(?:platform|product|app|application|workspace|tool that|turns |lets |helps |journal|exam[- ]prep|learning|wellness|budget|collaborat\w*|cleanup|aggregat\w*|job[- ]search|3d|spatial|postings?|students?|teams?|files?|users?|companion|practice|flashcards?|mood|expenses?|assets?|viewer|tracker)\b/i;
const IMPLEMENTATION_LEAD =
  /^(?:built|engineered|implemented|designed|added|wired|modeled|defined|shipped)\b[\s\S]{0,80}\b(?:pipeline|schema|endpoint|api|service|queue|worker|constraint)\b/i;

export function auditProjectBullets(projects: { id?: string; bullets: string[] }[]): BulletIssue[] {
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
    if (howTech.length === 0) {
      add(name, "high", `bullet 2 ("${howShort}") names no technology — this is the implementation line`);
    } else if (howTech.length > 2) {
      add(name, "high", `bullet 2 names ${howTech.length} technologies (${howTech.join(", ")}) — max 2, or it reads as a keyword list`);
    }
    if (!TECHNIQUE_SIGNAL.test(how)) {
      add(
        name,
        "high",
        `bullet 2 ("${howShort}") lists tech with no technique — name the index, worker, scheduler, or constraint that made the feature work`
      );
    }
  }
  return issues;
}

/** Feedback block for the repair pass. Specific failures only — generic scolding changes nothing. */
export function qualityFeedback(issues: BulletIssue[]): string {
  const high = issues.filter((i) => i.severity === "high");
  const low = issues.filter((i) => i.severity === "low");
  const lines = [...high, ...low].map((i) => `- [${i.company}] ${i.message}`);
  return [
    "QUALITY REPAIR PASS. Your previous draft failed these specific checks. Rewrite the flagged experience and project bullets from scratch to fix every one of them while following all original rules (bullet_count_rule still governs experience count and length; projects stay at exactly 2 bullets — purpose, then implementation):",
    ...lines,
    "Do not simply reword the flagged bullets. Recompose affected experience entries so each one reads like a real few months on a real team: one build, one fix, one piece of work involving other people, each with a concrete artifact and at most two named technologies. For projects: bullet 1 is what the product is (plain English, at most one technology); bullet 2 is distinctive features + tech + technique, framed to this posting.",
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
