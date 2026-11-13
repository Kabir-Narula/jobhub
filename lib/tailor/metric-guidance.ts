import type { RoleFamily } from "./role-family";

/**
 * Role-mapped metric guidance: what KINDS of numbers are plausible for a
 * junior candidate in this job family, with ceilings. The model picks concrete
 * values per job — this is the shape and the bound, not a script.
 *
 * Design rule (from the autonomous-optimization mandate): invented metrics
 * must be professionally plausible, technically plausible, and consistent with
 * junior scope. Ceilings are deliberately low — a number a new grad could not
 * have measured is the fastest fabrication tell there is.
 */
export interface MetricGuidance {
  family: string;
  allowedShapes: string[];
  ceilings: string[];
  bannedShapes: string[];
}

const BASE_BANNED = [
  "millions of users or requests",
  "company-level revenue, ARR, or deal sizes",
  "uptime/SLA figures an intern would not own (99.9%)",
  "multipliers over 2x without a stated baseline",
  "percentages above 60% without a stated baseline",
];

const GUIDANCE: Record<string, Omit<MetricGuidance, "family" | "bannedShapes">> = {
  swe: {
    // Shape descriptions deliberately avoid concrete numerals — the model used
    // to parrot the examples verbatim ("40 minutes", "400ms to 120ms") into
    // resumes, where they read as fabricated metrics.
    // NOTE: percentages are banned by BANNED_NUMBERS in bullet-quality.ts so
    // guidance stays 100% aligned with the audit gate (counts & durations only).
    allowedShapes: [
      "a before/after duration on something slow or manual (a long manual export cut to minutes)",
      "latency before/after on a slow lookup, in the low hundreds of milliseconds",
      "a count a junior genuinely knows (test cases closed, services, endpoints, team size, release cycles)",
      "rows or records processed per run (tens of thousands, never millions)",
      "error or failure counts per cycle (single to double digits, e.g. 6 recurring defects closed)",
    ],
    ceilings: [
      "users: hundreds max, and only for internal tools",
      "requests per second: tens to low hundreds",
      "time saved: single-digit hours per week",
      "no percentage improvements or multipliers (use concrete before/after durations or counts)",
    ],
  },
  "data-ml": {
    allowedShapes: [
      "rows/night processed by a pipeline (tens of thousands)",
      "pipeline or report duration before/after",
      "evaluation sample size or error-case count on an internal test set (e.g. 14 prompt fixtures)",
      "count of scheduled jobs, sources, or dashboards (single to double digits)",
      "data-quality issue counts found and resolved per review",
    ],
    ceilings: [
      "dataset size: tens of thousands of rows, never terabytes",
      "no percentage improvements or production SLO claims",
    ],
  },
  infra: {
    allowedShapes: [
      "deploy or release duration before/after",
      "count of services, environments, flaky checks removed, or dashboards maintained",
      "manual runbook steps cut down to a single command or automated check",
      "incident or alert counts per week reduced to single digits",
      "hours saved per week on manual triage or setup",
    ],
    ceilings: [
      "no fleet-wide SLOs, no cluster scale, no percentages or cost figures above a few hundred dollars",
    ],
  },
  consulting: {
    allowedShapes: [
      "hours saved per week on a manual process (single digits) — only when the work was process ops",
      "report or review cycle time before/after",
      "count of briefs, sources reviewed, stakeholders walked through, or sites compared (single to low double digits)",
      "a qualitative state change with no number (chase stopped, decision made, report went out clean)",
      "rows or records reconciled per review cycle when the work was reconciliation",
    ],
    ceilings: [
      "no deal sizes, no revenue, no client counts above a handful",
      "do not invent automation percentages on tool-silent MBB postings",
    ],
  },
  analyst: {
    allowedShapes: [
      "hours saved per week on a manual process (single digits) — only when real",
      "report or review cycle time before/after",
      "count of sources monitored, briefs delivered, segments cut, or stakeholders supported",
      "a qualitative state change with no number (brief used in a decision, chase stopped)",
      "rows or records reconciled per review cycle when the work was reconciliation",
    ],
    ceilings: [
      "no deal sizes, no revenue, no client counts above a handful",
      "do not invent Tableau/IQVIA scale metrics",
    ],
  },
  product: {
    allowedShapes: [
      "adoption or usage of a small feature (tens of users, never thousands)",
      "feedback or issue counts triaged per cycle",
      "a conversion or completion rate on a small funnel, stated approximately",
      "time from request to delivery before/after",
    ],
    ceilings: [
      "no growth percentages above 60%, no revenue, no enterprise client claims",
    ],
  },
};

export function metricGuidanceFor(family: RoleFamily): MetricGuidance {
  const g = GUIDANCE[family] ?? GUIDANCE.swe;
  return {
    family,
    // Zhang & Schwarz (JCR 2012; JESP 2013): fine-grained uneven quantities
    // ("14 minutes", "6 files") are read as measured; round marketing figures
    // ("30%", "10x", "50") are read as estimates. Precision on every line
    // looks automated, and the precision advantage disappears when the
    // source looks non-human. So invent two uneven counts, not a round
    // percent on every bullet. Parsers (Textkernel, RChilli, Daxtra) store
    // the digit inside the bullet text; they do not score its size.
    allowedShapes: [
      "uneven junior counts (3, 6, 8, 14), not round tens (10, 20, 50) and not a percent",
      ...g.allowedShapes,
    ],
    ceilings: [...(g.ceilings ?? []), ...BASE_BANNED],
    bannedShapes: BASE_BANNED,
  };
}

/** canon() in match.ts squashes some synonyms ("google cloud" -> "googlecloud"). */
export function jdTechHome(term: string): string | undefined {
  const t = term.toLowerCase();
  return JD_TECH_HOME[t] ?? JD_TECH_HOME[t.replace(/\s+/g, "")];
}

const PROPER_CASE: Record<string, string> = {
  cicd: "CI/CD",
  devops: "DevOps",
  javascript: "JavaScript",
  typescript: "TypeScript",
  "node.js": "Node.js",
  langchain: "LangChain",
  langgraph: "LangGraph",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  graphql: "GraphQL",
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  elasticsearch: "Elasticsearch",
  postman: "Postman",
  gitlab: "GitLab",
  github: "GitHub",
  dynamodb: "DynamoDB",
  "rest api": "REST API",
  "rest apis": "REST APIs",
  restapi: "REST APIs",
  "github actions": "GitHub Actions",
  "github copilot": "GitHub Copilot",
  copilot: "GitHub Copilot",
  chatgpt: "ChatGPT",
  googlecloud: "Google Cloud",
  sqlserver: "SQL Server",
  springboot: "Spring Boot",
  springframework: "Spring Framework",
  machinelearning: "Machine Learning",
  artificialintelligence: "Artificial Intelligence",
  businessintelligence: "Business Intelligence",
  marketresearch: "Market Research",
  powerquery: "Power Query",
  indexmatch: "INDEX/MATCH",
  powerbi: "Power BI",
  html: "HTML",
  css: "CSS",
  "ai assisted development": "AI-Assisted Development",
};

const ACRONYMS = new Set(["aws", "gcp", "api", "apis", "sql", "ci", "cd", "dbt", "php", "go", "html", "css", "llm", "nlp", "rag", "etl", "ui", "ux", "uat", "sso"]);

/** Resume-display casing for a JD term entering the skills section. */
export function displayTech(term: string): string {
  const lower = term.toLowerCase();
  if (PROPER_CASE[lower]) return PROPER_CASE[lower];
  return term
    .split(/\s+/)
    .map((w) => {
      const lw = w.toLowerCase();
      if (ACRONYMS.has(lw)) return lw.toUpperCase();
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(" ");
}

/**
 * Skills homes for JD technologies the candidate can plausibly be adjacent to
 * (same ecosystem as verified work, or learnable in two weeks at junior scope).
 * A JD term present here may enter the skills section under its home label
 * even without a bullet backing it — the skills section is the ATS keyword
 * home; experience stays coherent. NOT in this map = stays out.
 */
export const JD_TECH_HOME: Record<string, "Languages" | "Infra & Tools" | "Frameworks" | "Cloud & Data"> = {
  java: "Languages",
  javascript: "Languages",
  kotlin: "Languages",
  go: "Languages",
  golang: "Languages",
  rust: "Languages",
  scala: "Languages",
  "c#": "Languages",
  ruby: "Languages",
  php: "Languages",
  swift: "Languages",
  spring: "Frameworks",
  springboot: "Frameworks",
  "spring boot": "Frameworks",
  django: "Frameworks",
  flask: "Frameworks",
  rails: "Frameworks",
  laravel: "Frameworks",
  "asp.net": "Frameworks",
  ".net": "Frameworks",
  angular: "Frameworks",
  node: "Frameworks",
  "node.js": "Frameworks",
  html: "Frameworks",
  css: "Frameworks",
  vue: "Frameworks",
  svelte: "Frameworks",
  langchain: "Frameworks",
  springframework: "Frameworks",
  aws: "Cloud & Data",
  azure: "Cloud & Data",
  gcp: "Cloud & Data",
  "google cloud": "Cloud & Data",
  snowflake: "Cloud & Data",
  databricks: "Cloud & Data",
  bigquery: "Cloud & Data",
  redshift: "Cloud & Data",
  airflow: "Cloud & Data",
  dbt: "Cloud & Data",
  kafka: "Cloud & Data",
  spark: "Cloud & Data",
  hadoop: "Cloud & Data",
  mongodb: "Cloud & Data",
  elasticsearch: "Cloud & Data",
  dynamodb: "Cloud & Data",
  cassandra: "Cloud & Data",
  googlecloud: "Cloud & Data",
  sqlserver: "Cloud & Data",
  restapi: "Cloud & Data",
  graphql: "Cloud & Data",
  cicd: "Infra & Tools",
  kubernetes: "Infra & Tools",
  devops: "Infra & Tools",
  "ci cd": "Infra & Tools",
  copilot: "Infra & Tools",
  "github copilot": "Infra & Tools",
  chatgpt: "Infra & Tools",
  github: "Infra & Tools",
  gitlab: "Infra & Tools",
  "ai assisted development": "Infra & Tools",
  "testing framework": "Infra & Tools",
  "automated testing": "Infra & Tools",
  terraform: "Infra & Tools",
  ansible: "Infra & Tools",
  jenkins: "Infra & Tools",
  circleci: "Infra & Tools",
  prometheus: "Infra & Tools",
  grafana: "Infra & Tools",
  datadog: "Infra & Tools",
  splunk: "Infra & Tools",
  rabbitmq: "Infra & Tools",
  celery: "Infra & Tools",
  pytest: "Infra & Tools",
  jest: "Infra & Tools",
  vitest: "Infra & Tools",
  cypress: "Infra & Tools",
  playwright: "Infra & Tools",
  junit: "Infra & Tools",
};
