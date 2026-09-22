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
    allowedShapes: [
      "before/after duration on something slow or manual (a 40-minute export down to about 5 minutes)",
      "latency in the low hundreds of milliseconds (lookup went from ~400ms to ~120ms)",
      "a count a junior genuinely knows (about 40 test cases, 3 services, a 12-person team, two release cycles)",
      "percentage improvement WITH a baseline, 15-60% (cut failed runs from about 40% to under 10%)",
      "rows or records processed per run (tens of thousands, never millions)",
      "error or failure counts per cycle (single to double digits)",
    ],
    ceilings: [
      "users: hundreds max, and only for internal tools",
      "requests per second: tens to low hundreds",
      "time saved: single-digit hours per week",
      "percentages: 15-60%, always with the baseline named",
    ],
  },
  "data-ml": {
    allowedShapes: [
      "rows/night processed by a pipeline (tens of thousands)",
      "pipeline or report duration before/after",
      "model accuracy on a small internal evaluation set, stated as approximate",
      "count of scheduled jobs, sources, or dashboards (single to double digits)",
      "data-quality issue counts found per review",
    ],
    ceilings: [
      "dataset size: tens of thousands of rows, never terabytes",
      "model metrics: approximate and internal, never production SLOs",
    ],
  },
  infra: {
    allowedShapes: [
      "deploy or release duration before/after",
      "count of services, environments, or dashboards maintained",
      "percentage of manual steps removed from a runbook (15-60%)",
      "incident or alert counts per week reduced to single digits",
      "cost of one resource reduced by a small absolute amount",
    ],
    ceilings: [
      "no fleet-wide SLOs, no cluster scale, no cost figures above a few hundred dollars",
    ],
  },
  consulting: {
    allowedShapes: [
      "hours saved per week on a manual process (single digits)",
      "report or review cycle time before/after",
      "count of reports, dashboards, or stakeholders supported",
      "percentage of a manual step automated or removed (15-60%)",
      "rows or records reconciled per review cycle",
    ],
    ceilings: [
      "no deal sizes, no revenue, no client counts above a handful",
    ],
  },
  analyst: {
    allowedShapes: [
      "hours saved per week on a manual process (single digits)",
      "report or review cycle time before/after",
      "count of reports, dashboards, or stakeholders supported",
      "percentage of a manual step automated or removed (15-60%)",
      "rows or records reconciled per review cycle",
    ],
    ceilings: [
      "no deal sizes, no revenue, no client counts above a handful",
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
    allowedShapes: g.allowedShapes,
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
};

const ACRONYMS = new Set(["aws", "gcp", "api", "apis", "sql", "ci", "cd", "dbt", "php", "go"]);

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
  cicd: "Cloud & Data",
  graphql: "Cloud & Data",
  kubernetes: "Infra & Tools",
  devops: "Infra & Tools",
  "ci cd": "Infra & Tools",
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
