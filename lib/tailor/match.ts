const STOPWORDS = new Set(
  `the a an and or of to in for with on at by from as is are was were be been being this that these those you your we our they their it its he she his her i me my him them us will would can could should may might must shall not no do does did done have has had having than then so such if when where while who whom whose which what how why all any both each few more most other some own same only very just about into over under again further once here there out up down off above below between through during before after against within without along across behind beyond plus per via etc work working team teams role job candidate candidates ability strong experience experienced skills skill requirements preferred qualifications responsibilities opportunity opportunities opportunitie including include includes included across areas area support supporting clients client services service new grad full time position join joining years year day days week weeks months month professional professionals talent provide provides provided process policy application applications apply applying personal build building built together core workplace worklife balance
  `.split(/\s+/)
);

/** Normalize a token for matching: lowercase, edge-trim, singular-ish. */
const NO_DEPLURAL = new Set(["kubernetes"]); // ends in 's' but isn't a plural
function norm(w: string): string {
  let x = w.toLowerCase().replace(/^[./#+-]+|[./#+-]+$/g, "");
  if (x.length > 4 && x.endsWith("s") && !x.endsWith("ss") && !x.includes(".") && !NO_DEPLURAL.has(x)) x = x.slice(0, -1);
  return x;
}

/** Words that make a phrase noise, not a skill signal. */
const PHRASE_NOISE = new Set(
  "care genuine people team tool tools work company culture environment fast paced passionate dynamic love loved strong great good excellent world class day life way things thing lot make makes made help helps helping including across areas area support supporting clients client services service members member firm firms global network methodology methodologies trillion requisition compensation tuition reimbursement rrsp 401k dental winning enthusiastic purpose ulc inclusive perks perk benefits benefit leader leadership participate actively community communities forum forums mindset familiarity discovery focusing individual committed collaborate grow growth impact innovation knowledge understanding success goal value values mission interest range career graduate show technology technologies using advanced hands related field qualification degree master phd bachelor summary general innovator well health responsibilitie technologie excited exciting curious curiosity driven thrive enjoy enjoying commitment lifelong learner learners exceptionally smart dedicated confident ideal tasked duties duty assist hiring hire hired want feel creative creativity consultancy consulting consultant financial group offering offerings digital consumer consumers enterprise enterprises hundred million billion thousand worldwide generation looking vary based pay type best track record forward thinking innovative employee employees employer location locations level eg".split(" ")
);

/** Well-known equivalences so Postgres == PostgreSQL, k8s == Kubernetes, etc. */
const SYNONYMS: [RegExp, string][] = [
  [/^postgres(ql)?$/, "postgresql"],
  [/^k8s$/, "kubernetes"],
  [/^(js|javascript)$/, "javascript"],
  [/^(ts|typescript)$/, "typescript"],
  [/^ml$/, "machinelearning"],
  [/^machine learning$/, "machinelearning"],
  [/^ai$/, "artificialintelligence"],
  [/^(ci\/?cd|ci cd|cicd)$/, "cicd"],
  [/^(rest|restful|rest api|rest apis)$/, "restapi"],
  [/^(sql server|microsoft sql server|mssql)$/, "sqlserver"],
  [/^(gcp|google cloud|google cloud platform)$/, "googlecloud"],
  [/^(aws|amazon web services)$/, "aws"],
  [/^(llm|llms|large language model|large language models)$/, "llm"],
  [/^(etl|elt)$/, "etl"],
  [/^(bi|business intelligence)$/, "businessintelligence"],
  [/^(db|database|databases)$/, "database"],
];

function canon(term: string): string {
  const n = term.toLowerCase().replace(/[-/]+/g, " ").trim();
  for (const [re, canon] of SYNONYMS) {
    if (re.test(n)) return canon;
  }
  return n.replace(/\s+/g, " ");
}

/** Cut JD boilerplate (legal/EEO/privacy/benefits tails) — it pollutes keyword extraction. */
const BOILERPLATE_MARKERS = [
  "privacy policy", "equal opportunit", "accommodation", "accessibilit", "eeo",
  "we thank all", "only candidates", "only those selected", "application process",
  "background check", "diversity and inclusion", "commitment to diversity", "legal",
  "benefit", "benefits", "what we offer", "why join", "perks", "compensation and benefits",
  "our total rewards", "total rewards",
];

function stripBoilerplate(jd: string): string {
  const lower = jd.toLowerCase();
  let cut = jd.length;
  for (const m of BOILERPLATE_MARKERS) {
    const idx = lower.indexOf(m);
    if (idx > jd.length * 0.4) cut = Math.min(cut, idx); // only cut past 40% (avoid false hits in real content)
  }
  return jd.slice(0, cut);
}

/** Extract distinctive unigrams + bigrams from the JD. */
export function jdTerms(jobDescription: string, cap = 40, excludeTokens: string[] = []): string[] {
  const exclude = new Set(excludeTokens.map((t) => norm(t)));
  const clean = stripBoilerplate(jobDescription).toLowerCase();
  // Noise checks run on the RAW word (stopword lists hold natural forms like
  // "responsibilities"); norm() runs after, for storage/canonicalization.
  const keep = (raw: string) =>
    raw.length > 2 && !STOPWORDS.has(raw) && !PHRASE_NOISE.has(raw) && !exclude.has(norm(raw));
  const tokens = (clean.match(/[a-z][a-z0-9+#.\/-]{1,}/g) ?? []).filter(keep).map(norm);
  const uniFreq = new Map<string, number>();
  for (const t of tokens) uniFreq.set(t, (uniFreq.get(t) ?? 0) + 1);

  // Bigrams are built WITHIN sentence/clause segments only — joining across
  // punctuation produced garbage pairs ("rag fine" from "RAG, fine-tuning",
  // "summary leading" from "Summary. Leading...") that crowded out real terms.
  // A bigram must also recur (f >= 2): one-off adjacencies are prose, not requirements.
  const biFreq = new Map<string, number>();
  for (const seg of clean.split(/[.,;:!?\n•·|()[\]–—]+/)) {
    const words = seg.match(/[a-z][a-z0-9+#.\/-]{1,}/g) ?? [];
    for (let i = 0; i < words.length - 1; i++) {
      // noise components break the chain — skipping (not filtering) avoids
      // phantom pairs like "control collaboration" from "control and collaboration"
      if (!keep(words[i]) || !keep(words[i + 1])) continue;
      const a = norm(words[i]);
      const b = norm(words[i + 1]);
      if (a.length < 3 || b.length < 2) continue;
      const bg = `${a} ${b}`;
      biFreq.set(bg, (biFreq.get(bg) ?? 0) + 1);
    }
  }

  const scored = new Map<string, number>();
  // Tech-lexicon terms are what ATS ranking actually keys on — boost them so a
  // single "Kafka" outranks paragraphs of marketing prose at equal frequency.
  const techBoost = (t: string) => (isTechTerm(t) || CANON_TECH.has(t) ? 4 : 1);
  for (const [t, f] of uniFreq) {
    const c = canon(t);
    scored.set(c, (scored.get(c) ?? 0) + f * techBoost(c));
  }
  for (const [t, f] of biFreq) {
    if (f >= 2) {
      const c = canon(t);
      scored.set(c, (scored.get(c) ?? 0) + f * 2.5 * (techBoost(c) > 1 ? 2 : 1)); // phrases matter more
    }
  }
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([t]) => t);
}

function plainTex(tex: string): string {
  return tex
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ")
    .replace(/[{}$]/g, " ")
    .replace(/[-/]+/g, " ")
    .toLowerCase()
    // canonicalize single-token synonym surface forms the way jdTerms canon()
    // does, so "AI" in the resume covers the JD term "artificialintelligence"
    .replace(/\bai\b/g, "artificialintelligence")
    .replace(/\bml\b/g, "machinelearning")
    .replace(/\bk8s\b/g, "kubernetes")
    .replace(/\bpostgres\b/g, "postgresql")
    .replace(/\bllms\b/g, "llm")
    .replace(/\bgcp\b/g, "googlecloud")
    .replace(/\bmssql\b/g, "sqlserver")
    .replace(/\belt\b/g, "etl")
    .replace(/\bdb\b/g, "database");
}

/**
 * ATS keyword coverage: top distinctive JD terms/phrases (canonicalized)
 * found in the resume text. Rough but much closer to real ATS behavior
 * than single-word overlap.
 */
/** A term is covered when: exact phrase, squashed phrase, or every word present (ATS-style proximity). */
function covered(term: string, plain: string, plainSquash: string): boolean {
  if (plain.includes(term)) return true;
  if (plainSquash.includes(term.replace(/\s+/g, ""))) return true;
  const words = term.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return false;
  return words.every((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(plain));
}

export function matchScore(jobDescription: string, resumeTex: string, companyName = ""): number | null {
  if (!jobDescription.trim()) return null; // no JD to score against — display as "—", not 0%
  const terms = claimableJdTerms(jobDescription, 40, companyName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  if (terms.length === 0) return null;
  const plain = plainTex(resumeTex);
  const plainSquash = plain.replace(/\s+/g, "");
  const hits = terms.filter((t) => covered(t, plain, plainSquash)).length;
  return Math.round((hits / terms.length) * 100);
}

/**
 * Tech-shape test for skills-section material. JD prose ("design", "pay",
 * "operational", "cross") is legitimate bullet vocabulary but must never be
 * placed in a skills block or headline — parsers file it as skills data and
 * recruiters read it as keyword stuffing.
 */
const TECH_LEXICON = new Set(
  `python java javascript typescript kotlin swift go golang rust ruby scala php perl r matlab c c++ c# haskell sql mysql postgres postgresql sqlite mongodb mongo redis elasticsearch cassandra dynamodb snowflake redshift bigquery databricks spark pyspark hadoop kafka airflow flink etl elt dbt hive presto clickhouse react nextjs next.js node node.js express fastapi django flask spring springboot angular vue svelte rails laravel dotnet .net asp.net graphql rest grpc trpc prisma drizzle sqlalchemy hibernate docker kubernetes k8s terraform ansible jenkins gitlabci circleci cicd ci/cd aws azure gcp ec2 s3 lambda ecs eks rds cloudflare vercel render heroku linux unix bash git github gitlab jira confluence agile scrum devops sre ml ai nlp llm rag openai pytorch tensorflow keras sklearn pandas numpy opencv cuda mlops langchain fastapi supabase firebase stripe bullmq celery rabbitmq nginx prometheus grafana splunk datadog selenium cypress playwright jest vitest pytest junit mockito espresso xctest xcode android ios`.split(/\s+/)
);

export function isTechTerm(term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  if (t.length < 2 && t !== "r") return false; // "c" alone is JD noise; "C++" is the real term
  if (/^[a-z0-9-]+\.(com|ca|io|ai|org|net|dev|co|app)$/.test(t)) return false; // bare domains are never skills
  if (/^([a-z]\.)+[a-z]?$/.test(t)) return false; // abbreviations like "u.s", "u.k"
  if (/[+#0-9]/.test(t)) return true; // c++, c#, .net, 3scale...
  if (t.includes(".") && !t.endsWith(".")) return true; // node.js, next.js, asp.net
  const words = t.split(/\s+/);
  if (words.every((w) => TECH_LEXICON.has(w))) return true;
  // bigrams with a tech head noun: "rest api", "machine learning", "data pipeline"
  if (words.length === 2 && /^(api|apis|sql|nosql|cloud|ml|ai|ci|cd|ui|ux|os)$/.test(words[1])) return true;
  // tech-prefix bigrams need a tech-noun head too — "event streaming" yes, "event driven" no
  if (
    words.length === 2 &&
    /^(machine|deep|data|distributed|cloud|rest|graphql|event|stream|batch|ci|test)/.test(words[0]) &&
    /^(learning|pipelines?|streaming|processing|computing|systems?|services?)$/.test(words[1])
  )
    return true;
  return false;
}

/** Canonical single-token forms produced by SYNONYMS above — all tech terms. */
const CANON_TECH = new Set(
  "postgresql kubernetes javascript typescript machinelearning artificialintelligence cicd restapi sqlserver googlecloud aws llm etl database businessintelligence".split(" ")
);

/**
 * Claimable = something a candidate can truthfully have on a resume and an
 * ATS can rank: a tech term, or a skill-shaped phrase with a concrete head
 * noun ("code review", "computer science", "data pipelines"). Attitude words
 * ("curious", "forward thinking") and unclaimable domain nouns ("satellite")
 * are excluded — they must never drive the score or the boost pass.
 */
const CLAIM_HEADS = new Set(
  "api apis application applications system systems service services pipeline pipelines database databases schema schemas review reviews testing test tests deployment deployments infrastructure monitoring security automation integration integrations migration migrations optimization optimizations design designs pattern patterns architecture architectures debugging documentation framework frameworks cloud clouds container containers algorithm algorithms structure structures network networking server servers development engineering science computing programming stack stacks frontend backend fullstack mobile web ui ux data ml ai ci cd os devops observability reliability scalability performance concurrency threading parsing rendering caching authentication authorization".split(" ")
);

export function isClaimableTerm(term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  if (CANON_TECH.has(t)) return true;
  if (isTechTerm(t)) return true;
  const words = t.split(/\s+/);
  if (words.length < 2) return false; // a lone non-tech word is prose, not a skill
  return CLAIM_HEADS.has(words[words.length - 1]);
}

/** JD terms worth optimizing for: distinctive AND claimable. Extracts from a deep
 *  pool so thin/fluffy JDs still surface their few real tech terms (frequency
 *  ranking buries f=1 tools like "Kafka" under benefits prose in a top-40 cut). */
export function claimableJdTerms(jobDescription: string, cap = 40, excludeTokens: string[] = []): string[] {
  return jdTerms(jobDescription, Math.max(cap * 3, 120), excludeTokens).filter(isClaimableTerm).slice(0, cap);
}

/** Missing terms for display (what the resume doesn't cover) — claimable only. */
export function missingTerms(jobDescription: string, resumeTex: string, cap = 12, companyName = ""): string[] {
  const plain = plainTex(resumeTex);
  const plainSquash = plain.replace(/\s+/g, "");
  return claimableJdTerms(jobDescription, 60, companyName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    .filter((t) => !covered(t, plain, plainSquash))
    .slice(0, cap);
}

/**
 * Misplaced terms: present somewhere in the resume but absent from the
 * skills block. Parsers weight the skills section most heavily, and engines
 * calibrated on real ranking behavior treat placement as a separate signal
 * from presence. Returns top gaps for deterministic backfill.
 */
export function placementGaps(jobDescription: string, resumeTex: string, cap = 6, companyName = ""): string[] {
  const m = /\\section\{(?:Skills|Technical[^}]*)\}([\s\S]*?)\\end\{itemize\}/i.exec(resumeTex);
  if (!m) return [];
  const skillsPlain = plainTex(m[1]);
  const skillsSquash = skillsPlain.replace(/\s+/g, "");
  const full = plainTex(resumeTex);
  const fullSquash = full.replace(/\s+/g, "");
  return jdTerms(jobDescription, 40, companyName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    .filter((t) => covered(t, full, fullSquash) && !covered(t, skillsPlain, skillsSquash))
    .filter(isTechTerm) // only skill-shaped terms belong in a skills block
    .slice(0, cap);
}
