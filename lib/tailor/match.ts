const STOPWORDS = new Set(
  `the a an and or of to in for with on at by from as is are was were be been being this that these those you your we our they their it its he she his her i me my him them us will would can could should may might must shall not no do does did done have has had having than then so such if when where while who whom whose which what how why all any both each few more most other some own same only very just about into over under again further once here there out up down off above below between through during before after against within without along across behind beyond plus per via etc work working team teams role job candidate candidates ability strong experience experienced skills skill requirements preferred qualifications responsibilities opportunity opportunities opportunitie including include includes included across areas area support supporting clients client services service new grad full time position join joining years year day days week weeks months month professional professionals talent provide provides provided process policy application applications apply applying personal build building built together core workplace worklife balance
  `.split(/\s+/)
);

/** Normalize a token for matching: lowercase, edge-trim, singular-ish. */
function norm(w: string): string {
  let x = w.toLowerCase().replace(/^[./#+-]+|[./#+-]+$/g, "");
  if (x.length > 4 && x.endsWith("s") && !x.endsWith("ss")) x = x.slice(0, -1);
  return x;
}

/** Words that make a phrase noise, not a skill signal. */
const PHRASE_NOISE = new Set(
  "care genuine people team tool tools work company culture environment fast paced passionate dynamic love loved strong great good excellent world class day life way things thing lot make makes made help helps helping including across areas area support supporting clients client services service members member firm firms global network methodology methodologies".split(" ")
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
  [/^(ci\/?cd|cicd)$/, "cicd"],
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

/** Cut JD boilerplate (legal/EEO/privacy tails) — it pollutes keyword extraction. */
const BOILERPLATE_MARKERS = [
  "privacy policy", "equal opportunit", "accommodation", "accessibilit", "eeo",
  "we thank all", "only candidates", "only those selected", "application process",
  "background check", "diversity and inclusion", "commitment to diversity", "legal",
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
  const tokens = (stripBoilerplate(jobDescription).toLowerCase().match(/[a-z][a-z0-9+#.\/-]{1,}/g) ?? [])
    .map(norm)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !PHRASE_NOISE.has(w) && !exclude.has(w));
  const uniFreq = new Map<string, number>();
  for (const t of tokens) uniFreq.set(t, (uniFreq.get(t) ?? 0) + 1);

  const words = stripBoilerplate(jobDescription).toLowerCase().match(/[a-z][a-z0-9+#.\/-]{1,}/g) ?? [];
  const biFreq = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const a = norm(words[i]);
    const b = norm(words[i + 1]);
    if (a.length < 3 || b.length < 2 || STOPWORDS.has(a) || STOPWORDS.has(b) || PHRASE_NOISE.has(a) || PHRASE_NOISE.has(b) || exclude.has(a) || exclude.has(b)) continue;
    const bg = `${a} ${b}`;
    biFreq.set(bg, (biFreq.get(bg) ?? 0) + 1);
  }

  const scored = new Map<string, number>();
  for (const [t, f] of uniFreq) scored.set(canon(t), (scored.get(canon(t)) ?? 0) + f);
  for (const [t, f] of biFreq) {
    if (f >= 1) scored.set(canon(t), (scored.get(canon(t)) ?? 0) + f * 2.5); // phrases matter more
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
    .toLowerCase();
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

export function matchScore(jobDescription: string, resumeTex: string, companyName = ""): number {
  const terms = jdTerms(jobDescription, 40, companyName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  if (terms.length === 0) return 0;
  const plain = plainTex(resumeTex);
  const plainSquash = plain.replace(/\s+/g, "");
  const hits = terms.filter((t) => covered(t, plain, plainSquash)).length;
  return Math.round((hits / terms.length) * 100);
}

/** Missing terms for display (what the resume doesn't cover). */
export function missingTerms(jobDescription: string, resumeTex: string, cap = 12, companyName = ""): string[] {
  const plain = plainTex(resumeTex);
  const plainSquash = plain.replace(/\s+/g, "");
  return jdTerms(jobDescription, 60, companyName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    .filter((t) => !covered(t, plain, plainSquash))
    .slice(0, cap);
}
