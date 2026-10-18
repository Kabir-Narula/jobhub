import { PROJECTS } from "./projects";
import { model, openai, parseJson, type CompanyResearch } from "./research";

export interface EmailDraft {
  subject: string;
  body: string;
}

export type RecipientKind = "campus" | "recruiter" | "manager" | "engineer" | "unknown";

export interface EmailProject {
  name: string;
  url: string;
  oneLiner: string;
}

export const EMAIL_SIGNATURE = [
  "Kabir Narula",
  "Toronto, ON",
  "Kabirnar10@gmail.com | (647) 410-6699",
  "linkedin.com/in/kabir-narula-19b129260",
  "github.com/Kabir-Narula",
] as const;

const CANDIDATE = {
  fullName: "Kabir Narula",
  signOff: "Kabir",
  city: "Toronto",
  school: "Seneca Polytechnic",
  program: "Honours Bachelor of Technology, Software Development",
  degreePhrase: "Honours Bachelor of Technology in Software Development",
  grad: "August 2026",
  standing: "recent graduate, not a student",
  howHeSounds: [
    "Just graduated from Seneca Polytechnic in Toronto (Software Development, August 2026). He is a graduate in the market, never 'a student' or 'currently studying'.",
    "Recent intern: Python/FastAPI services + GitHub Actions at Seneca's INNWIL lab.",
    "Some freelance client work (Kotlin Android + React against shared APIs).",
    "Talks about his own products like a person, never like a resume bullet. VertexFlow = Git for 3D models, with a Linux/Blender worker behind a queue so the web app stays fast. BetterMind = a journaling app with mood tracking and an AI companion that already knows your entries.",
  ],
};

/**
 * The model writes ONLY the "why this company" lines. Greeting, intro, and the
 * ask are assembled in code so every email has the same proven structure.
 */
const INTEREST_PROMPT = `You write ONE short paragraph (1-2 sentences, max 45 words) for a cold email from Kabir Narula, a recent software graduate in Toronto. The paragraph says, in his own plain voice, why he genuinely likes THIS company and why this work is his area of interest.

The rest of the email is already written:
  "Hi {name}, I'm Kabir, I recently graduated from Seneca Polytechnic with an Honours Bachelor of Technology in Software Development. I just applied to the {role} role at {company} and I'm really interested in working there."
  {YOUR PARAGRAPH}
  {the ask: application review, or coffee chat / referral}
Do not repeat any of that. No greeting, no intro, no ask, no sign-off.

HOW TO MAKE IT AUTHENTIC:
- Name ONE concrete, specific thing: a recent move from recent_headlines (prefer the newest one that relates to this team or role), a real product, or what this team actually does per the job description. Specific beats impressive.
- Then connect it to HIS interest in a few words (data and analytics, building software people use, AI products, etc. - pick what fits this role). Optionally mention one of his projects in half a sentence if it genuinely connects.
- Sound like a 22-year-old talking to someone he respects: simple, warm, direct. "I saw that...", "What I like about..." and "That's the kind of work I want to be doing" are fine.
- ONLY use facts present in recent_headlines, company, or role_context. If nothing specific is given, talk about what the role/team works on from role_context. Never invent numbers, launches, awards, or quotes.
- Don't paste a headline. Paraphrase it naturally. No dates. No source names.
- Headlines come from a name search, so some are about a different company with a similar name or ticker. Skip any headline that doesn't clearly match company_research.
- Never mention earnings, profit, quarterly results, share buybacks, or anything about the stock. Talk about what they build, launch, or invest in, or what this team works on.

BANNED: passionate, excited to contribute, great fit, leverage, utilize, innovative, cutting-edge, world-class, industry leader, synergy, align with my values, resonates, deeply, thrilled, journey, em-dashes, markdown, exclamation marks, stock prices, layoffs, lawsuits.

GOOD EXAMPLES (style only, facts differ):
- "I saw that National Bank has been building out its data platform for the capital markets side, and using data to support real trading and risk decisions is exactly the kind of work I want to get into."
- "What I like about Wealthsimple is how simple they make investing feel for regular people. Building products that people actually use every day is what got me into software in the first place."
- "I saw ZS is putting a lot into AI tools for pharma commercial teams. I've been building with LLMs on my own projects, so seeing that applied to real business decisions is a big part of why I applied."

Return JSON: {"interest":"...","subject":"..."} where subject is "{role} - Kabir Narula".`;

const FOLLOWUP_PROMPT = `You write a short follow-up as Kabir Narula (Seneca grad, August 2026, not a student). 2-3 sentences, then the ask from the payload (copy it as given). No guilt. No apology theater.

Hi {First},

I applied about {N} days ago for the {role} role at {company} and I'm still really interested.

{ask from payload}

Thanks,

BANNED: circling back, touching base, gentle reminder, did you get my email, out of the blue, no need to reply, I know you're busy, em-dashes, markdown, P.S.
Subject: "following up - {role}". Return JSON {"subject":"...","body":"..."}.`;

export interface NewsHeadline {
  title: string;
  date: string | null;
}

export interface DraftInput {
  job: { title: string; company: string; description: string };
  contact: { name: string; role: string; email: string; why?: string } | null;
  research: CompanyResearch | null;
  projects: EmailProject[];
  hasFinalDocs: boolean;
  candidateName: string;
  news?: NewsHeadline[];
}

export function classifyRecipient(role: string | undefined | null): RecipientKind {
  const t = role ?? "";
  if (/university|campus|early[- ]career|new[- ]?grad|student program|emerging talent|graduate program/i.test(t)) {
    return "campus";
  }
  if (/recruit|talent|sourcer|staffing|people ops|people partner|\bhr\b|human resources|hrbp/i.test(t)) {
    return "recruiter";
  }
  if (/engineering manager|hiring manager|director|head of|team lead|tech lead|\bvp\b|vice president|\bcto\b|founder|\bmanager\b/i.test(t)) {
    return "manager";
  }
  if (/software|engineer|developer|swe|programmer|architect/i.test(t)) return "engineer";
  return "unknown";
}

/** Projects that actually appear on this job's tailored resume — spoken one-liners, not ATS bullets. */
export function projectsFromResumeTex(tex: string | null | undefined): EmailProject[] {
  const source = tex ?? "";
  const found = PROJECTS.filter((p) => source.includes(p.name));
  const picked = (found.length > 0 ? found : PROJECTS.filter((p) => p.id === "vertexflow" || p.id === "bettermind")).slice(0, 2);
  return picked.map((p) => ({ name: p.name, url: p.githubUrl, oneLiner: p.summary }));
}

function recipientFirst(contact: DraftInput["contact"]): string | null {
  const name = contact?.name?.trim();
  if (!name || /^unknown$/i.test(name)) return null;
  const first = name.split(/\s+/)[0];
  return first || null;
}

function researchForEmail(research: CompanyResearch | null) {
  if (!research) return null;
  const generic = /leading provider|world-class|cutting-edge|passionate about|innovative solutions/i;
  const clean = (s: string | undefined) => {
    const t = (s ?? "").trim();
    return t && !generic.test(t) ? t : null;
  };
  return {
    mission: clean(research.mission),
    product: clean(research.product),
    hookFact: clean(research.hookFact),
    recent: (research.news ?? []).map((n) => n.trim()).filter((n) => n && !generic.test(n)).slice(0, 4),
  };
}

const isHrKind = (kind: RecipientKind) => kind === "recruiter" || kind === "campus";

function askFor(kind: RecipientKind): string {
  return isHrKind(kind)
    ? "It would be great if you could take a look at my online application when you get a chance."
    : "Would you be open to a quick coffee chat sometime? And if you think I'd be a good fit, I'd really appreciate a referral.";
}

const ASK_RE_BY_HR = {
  hr: /take a look at my (online )?application/i,
  other: /coffee chat|referral/i,
};

const SIMPLE_QUESTION = "Is this still open?";
const COMMANDING_CLOSE =
  /appreciate a glance|when you have a chance|forward to the right person|if this role is on your team|please take a look|grateful if you took a look|look at the application|easier than (pulling it from )?the ats|easier than the ats|i'd be grateful if you|if you own this role|a glance when you have|15-minute|i'd love to (chat|connect)/i;
const FAKE_HUMILITY =
  /out of the blue|don'?t know me from anyone|you don'?t know me|i know you didn'?t ask|no need to reply if this isn'?t useful|sorry to bother|i know you'?re busy|silent row in the ats|put a name to it|weird to email someone|ignore this if it'?s not your world|anyway, ignore this/i;

function stripClerkTalk(p: string): string {
  let s = p
    .replace(/\s*Resume is attached in case it'?s easier than (pulling it from )?the ATS\.?/gi, "")
    .replace(/\s*in case (that'?s|it's) easier than (pulling it from )?the ATS\.?/gi, "")
    .replace(/\bthis is a bit out of the blue\.?\s*/gi, "")
    .replace(/\bsince you don'?t know me from anyone\.?\s*/gi, "")
    .replace(/,?\s*since you don'?t know me from anyone\.?/gi, "")
    .replace(/\bi know you didn'?t ask for this( note)?\.?\s*/gi, "")
    .replace(/\bno need to reply if this isn'?t useful\.?\s*/gi, "")
    .replace(/\bweird to email someone i'?ve never met\.?\s*/gi, "")
    .replace(/\band wanted to put a name to (it|the application),?\s*/gi, "");
  s = tidyLine(s).replace(/[,;:\s]+$/g, "");
  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
}
const CLOSE_RE = /^(thanks|thank you|best|cheers|regards|best regards|kind regards|warmly)[,!.]?$/i;
const SIGN_WITH_CLOSE_RE =
  /^(thanks|thank you|best|cheers|regards|best regards|kind regards|warmly)[,!]?\s+[A-Z][a-zA-Z'-]+[,!.]?$/i;

function tidyLine(s: string): string {
  return s
    .replace(/[—–]/g, " - ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,(?!\s|$)/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitParagraphs(text: string): string[] {
  const lines = text.split("\n").map((l) => tidyLine(l));
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks.map((linesInBlock) => tidyLine(linesInBlock.join(" "))).filter(Boolean);
}

function isSignName(para: string, opts: { signOff: string; recipientFirst: string | null }): boolean {
  const t = para.replace(/[,!.]+$/, "").trim();
  if (t.toLowerCase() === opts.signOff.toLowerCase()) return true;
  if (t.toLowerCase() === "kabir narula") return true;
  if (opts.recipientFirst && t.toLowerCase() === opts.recipientFirst.toLowerCase()) return true;
  return false;
}

function isSignatureDebris(para: string): boolean {
  const t = para.trim();
  if (/^kabir(\s+narula)?$/i.test(t.replace(/[,!.]+$/, ""))) return true;
  if (/^toronto,?\s*on$/i.test(t)) return true;
  if (/kabirnar10@gmail\.com/i.test(t) && t.length < 90) return true;
  if (/647[\s).-]*410[\s.-]*6699/.test(t) && t.length < 50) return true;
  if (/linkedin\.com\/in\/kabir-narula/i.test(t)) return true;
  if (/^(https?:\/\/(www\.)?)?github\.com\/Kabir-Narula\/?\s*$/i.test(t)) return true;
  return false;
}

function stripClichés(text: string): string {
  return text
    .replace(/^dear\s+[^,\n]+,?\s*/i, "")
    .replace(/\bi hope this (email )?finds you well[.,!]?\s*/gi, "")
    .replace(/\bjust (wanted to )?reach(?:ing)? out[.,!]?\s*/gi, "")
    .replace(/\b(circling back|touching base|gentle reminder)[.,!]?\s*/gi, "")
    .replace(/\bP\.?\s*S\.?:?[\s\S]*$/i, "")
    .replace(/^[.\s,;:]+$/gm, "");
}

/** If the model dumped one blob, split into apply / who-I-am / ask. */
function splitWall(para: string): string[] {
  const sentences =
    para.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((s) => tidyLine(s)).filter(Boolean) ?? [para];
  if (sentences.length <= 2) return sentences;
  if (sentences.length === 3) return sentences;
  return [sentences[0], sentences.slice(1, -1).join(" "), sentences[sentences.length - 1]];
}

function greetingLine(opts: { recipientFirst: string | null; company: string }): string {
  return opts.recipientFirst ? `Hi ${opts.recipientFirst},` : `Hi ${opts.company} team,`;
}

/**
 * Canonical layout (this is the source of truth, not the model):
 *
 * Hi Name,
 *                ← one blank line
 * paragraph
 *                ← one blank line
 * paragraph
 *                ← one blank line
 * Thanks,
 *
 * Kabir Narula
 * Toronto, ON
 * Kabirnar10@gmail.com | (647) 410-6699
 * linkedin.com/in/kabir-narula-19b129260
 * github.com/Kabir-Narula
 */
export function polishEmail(
  draft: EmailDraft,
  opts: { signOff: string; recipientFirst: string | null; company: string; kind?: RecipientKind }
): EmailDraft {
  const subject = String(draft.subject ?? "")
    .replace(/^["']|["']$/g, "")
    .replace(/[—–]/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();

  let text = String(draft.body ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/[*_]{1,2}([^*_\n]+)[*_]{1,2}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
  text = stripClichés(text);

  const blocks = splitParagraphs(text);
  if (blocks[0] && /^hi\b/i.test(blocks[0])) {
    const rest = blocks[0].replace(/^hi\b[\s\S]*?,\s*/i, "").trim();
    if (rest) blocks[0] = rest;
    else blocks.shift();
  }

  while (blocks.length) {
    const last = blocks[blocks.length - 1];
    if (isSignName(last, opts) || CLOSE_RE.test(last) || SIGN_WITH_CLOSE_RE.test(last) || isSignatureDebris(last)) {
      blocks.pop();
      continue;
    }
    break;
  }

  let paras = blocks.filter((p) => !/^hi\b/i.test(p));
  if (paras.length === 1) paras = splitWall(paras[0]);
  paras = paras.map((p) => stripClerkTalk(p)).filter(Boolean).slice(0, 4);
  if (opts.kind) {
    const ask = askFor(opts.kind);
    const askRe = isHrKind(opts.kind) ? ASK_RE_BY_HR.hr : ASK_RE_BY_HR.other;
    paras = paras.filter((p) => !FAKE_HUMILITY.test(p));
    const last = paras[paras.length - 1];
    if (!last || !askRe.test(last)) {
      paras = paras.filter((p) => !ASK_RE_BY_HR.hr.test(p) && !ASK_RE_BY_HR.other.test(p) && !COMMANDING_CLOSE.test(p));
      paras.push(ask);
    }
  } else {
    if (paras.length && (COMMANDING_CLOSE.test(paras[paras.length - 1]) || FAKE_HUMILITY.test(paras[paras.length - 1]))) {
      paras[paras.length - 1] = SIMPLE_QUESTION;
    }
    if (!paras.some((p) => /\?\s*$/.test(p))) paras.push(SIMPLE_QUESTION);
  }
  if (paras.length === 0) paras = [SIMPLE_QUESTION];

  const parts = [greetingLine(opts)];
  for (const p of paras) {
    parts.push("", p);
  }
  if (paras.length === 0) {
    parts.push("", SIMPLE_QUESTION);
  }
  parts.push("", "Thanks,", "", ...EMAIL_SIGNATURE);

  return { subject, body: parts.join("\n") };
}

/** "Junior Analyst, Data - CIB (Req 12345)" -> "Junior Analyst, Data - CIB" */
function cleanRoleTitle(title: string): string {
  return title
    .replace(/\s*[([]\s*(req|job|id|#)[^)\]]*[)\]]/gi, "")
    .replace(/\s*-\s*(toronto|remote|hybrid|ontario|canada)\b.*$/i, "")
    .replace(/\s+role$/i, "")
    .trim();
}

/** "NATIONAL BANK OF CANADA" -> "National Bank of Canada"; short acronyms like ZS / RBC stay as-is. */
function displayCompany(name: string): string {
  const n = name.trim();
  if (n.length <= 4 || n !== n.toUpperCase() || !/[A-Z]{2}/.test(n)) return n;
  const small = new Set(["of", "and", "the", "for", "in", "de", "du", "la", "et"]);
  return n
    .split(/\s+/)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      if (/^[A-Z&]{2,3}$/.test(w) && !/^(THE|AND)$/.test(w)) return w;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function introLine(input: DraftInput): string {
  return (
    `I'm Kabir, I recently graduated from ${CANDIDATE.school} with an ${CANDIDATE.degreePhrase}. ` +
    `I just applied to the ${cleanRoleTitle(input.job.title)} role at ${input.job.company} and I'm really interested in working there.`
  );
}

function interestArea(title: string): string {
  if (/data|analyt|insight|bi\b|intelligence|statistic/i.test(title)) return "data and analytics";
  if (/consult|strategy|business analyst|decision/i.test(title)) return "using data to solve real business problems";
  if (/\bai\b|machine learning|\bml\b|llm/i.test(title)) return "building AI products";
  if (/product/i.test(title)) return "building products people actually use";
  return "building software people actually use";
}

function fallbackInterest(input: DraftInput): string {
  const area = interestArea(input.job.title);
  return `From what I've read about ${input.job.company} and this team, the work lines up with what I want to do, and ${area} is exactly the area I want to build my career in.`;
}

const INTEREST_BANNED =
  /passionate|excited to contribute|great fit|leverag|utiliz|innovative|cutting-edge|world-class|industry leader|synergy|align(s)? with my values|resonat|thrilled|journey|!/i;

function cleanInterest(raw: string, input: DraftInput): string {
  let s = tidyLine(String(raw ?? "").replace(/\s*\n+\s*/g, " "));
  s = s.replace(/^(hi|hey)\b[^,]*,\s*/i, "");
  if (!s || INTEREST_BANNED.test(s) || ASK_RE_BY_HR.hr.test(s) || ASK_RE_BY_HR.other.test(s)) return fallbackInterest(input);
  if (s.split(/\s+/).length > 60) {
    const sentences = s.match(/[^.!?]+[.!?]+/g) ?? [s];
    s = sentences.slice(0, 2).join(" ").trim();
  }
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

async function completeRaw(system: string, user: unknown, tier: "quality" | "cheap"): Promise<Record<string, unknown>> {
  const res = await openai().chat.completions.create({
    model: model(tier),
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    response_format: { type: "json_object" },
  });
  return parseJson(res.choices[0]?.message?.content ?? "{}") ?? {};
}

async function completeJson(system: string, user: unknown, tier: "quality" | "cheap"): Promise<EmailDraft | null> {
  const parsed = await completeRaw(system, user, tier);
  const subject = typeof parsed.subject === "string" ? parsed.subject : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  if (!body.trim()) return null;
  return { subject, body };
}

function interestPayload(input: DraftInput) {
  return {
    company: input.job.company,
    role: cleanRoleTitle(input.job.title),
    his_interest_area_hint: interestArea(input.job.title),
    recent_headlines: (input.news ?? []).slice(0, 6),
    company_research: researchForEmail(input.research),
    role_context: input.job.description.replace(/\s+/g, " ").trim().slice(0, 1500),
    his_projects_optional: input.projects.map((p) => ({ name: p.name, what: p.oneLiner })),
    about_him: CANDIDATE.howHeSounds,
  };
}

function polishOpts(input: DraftInput) {
  return {
    signOff: CANDIDATE.signOff,
    recipientFirst: recipientFirst(input.contact),
    company: input.job.company,
    kind: classifyRecipient(input.contact?.role),
  };
}

/**
 * Hi {First},
 *
 * I'm Kabir, recent Seneca grad ... just applied to {role} at {company} ...
 *
 * {why this company + his area of interest}
 *
 * {recruiter/campus: look at my online application | everyone else: coffee chat or referral}
 */
export async function draftOutreachEmail(rawInput: DraftInput): Promise<EmailDraft> {
  const input = { ...rawInput, job: { ...rawInput.job, company: displayCompany(rawInput.job.company) } };
  const opts = polishOpts(input);
  let interest = "";
  let subject = "";
  try {
    const parsed = await completeRaw(INTEREST_PROMPT, interestPayload(input), "cheap");
    interest = typeof parsed.interest === "string" ? parsed.interest : "";
    subject = typeof parsed.subject === "string" ? parsed.subject : "";
  } catch {
    interest = "";
  }
  const body = [introLine(input), cleanInterest(interest, input), askFor(opts.kind)].join("\n\n");
  return polishEmail(
    { subject: subject.trim() || `${cleanRoleTitle(input.job.title)} - ${CANDIDATE.fullName}`, body },
    opts
  );
}

/** Follow-up nudge N days after applying with no response. */
export async function draftFollowUpEmail(rawInput: DraftInput & { daysSinceApplied: number }): Promise<EmailDraft> {
  const input = { ...rawInput, job: { ...rawInput.job, company: displayCompany(rawInput.job.company) } };
  const opts = polishOpts(input);
  const role = cleanRoleTitle(input.job.title);
  const generated = await completeJson(
    FOLLOWUP_PROMPT,
    {
      greeting: opts.recipientFirst ? `Hi ${opts.recipientFirst},` : `Hi ${input.job.company} team,`,
      role,
      company: input.job.company,
      days_since_applied: input.daysSinceApplied,
      ask: askFor(opts.kind),
      do_not_invent_new_work: true,
    },
    "cheap"
  ).catch(() => null);
  const raw =
    generated ??
    ({
      subject: `following up - ${role}`,
      body: [
        `I applied about ${input.daysSinceApplied} days ago for the ${role} role at ${input.job.company} and I'm still really interested.`,
        "",
        askFor(opts.kind),
      ].join("\n"),
    } satisfies EmailDraft);
  if (!raw.subject.trim()) raw.subject = `following up - ${role}`;
  return polishEmail(raw, opts);
}

