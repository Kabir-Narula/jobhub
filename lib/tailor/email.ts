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
  grad: "August 2026",
  standing: "recent graduate, not a student",
  howHeSounds: [
    "Just graduated from Seneca Polytechnic in Toronto (Software Development, August 2026). He is a graduate in the market, never 'a student' or 'currently studying'.",
    "Recent intern: Python/FastAPI services + GitHub Actions at Seneca's INNWIL lab.",
    "Some freelance client work (Kotlin Android + React against shared APIs).",
    "Talks about his own products like a person, never like a resume bullet. VertexFlow = Git for 3D models, with a Linux/Blender worker behind a queue so the web app stays fast. BetterMind = a journaling app with mood tracking and an AI companion that already knows your entries.",
  ],
};

const SYSTEM_PROMPT = `You write a short email as Kabir Narula, 22, software graduate in Toronto, to someone who does not know him. Write like a real person: warm, plain, specific. Not a sales email. Not a cover letter. Not an apology. And not a form letter: if this exact email could go to ten other companies unchanged, it is wrong.

WHAT ACTUALLY GETS READ (recruiters who sat through hundreds of these):
- 90 to 130 words. Two or three short paragraphs, then one easy question.
- Why you're writing lands in the first two sentences: he applied for this exact role.
- The middle connects ONE real thing about him to ONE real thing about this role or company, using the JD line or the researched product/hook in the payload. If nothing honestly connects, use one project in spoken English and skip the connection. Never invent company facts.
- The point of the email is the close: ask them to look at his application, or point him to the person who will. One sentence, low pressure, easy to say no to. Asking whether the role is still open is a wasted email; eyes on the application is the goal.

WHO KABIR IS (do not invent extra biography):
- Graduated August 2026, Seneca Polytechnic, Software Development, Toronto. NOT a student.
- Intern: Python/FastAPI + CI/CD at Seneca's INNWIL lab
- Side products in spoken English: VertexFlow = Git for 3D files, Linux/Blender worker so the site doesn't freeze. BetterMind = journaling app whose companion remembers past entries.

SHAPE (pick one per email and vary across emails; do not reuse the example sentences):
A. Applied, then connection, then ask.
B. Connection first ("the posting mentions X, and I built X"), then applied, then ask.
C. Only when real company research exists: one honest sentence on what they build or why it caught his eye, then applied, then connection, then ask.
Openings can vary: "I applied for", "I put in an application for", "saw the posting and applied". The same opening every time is the tell.

WARMTH, MEASURED:
- Contractions, plain words, one natural connector at most ("figured", "honestly") and some emails need none.
- Be gracious to a stranger through the ask, not the opener: "if you're not the right person to ask, no worries" is fine.
- Never apologize for writing, never narrate that this is a cold email, never flatter.

HARD BANS (all of these read as ChatGPT in 2026):
- Apology theater: "out of the blue", "you don't know me", "I know you didn't ask", "no need to reply if this isn't useful", "sorry to bother", "I know you're busy", "silent row in the ATS", "put a name to it"
- Orders dressed as politeness: "please glance", "when you have a chance", "a forward is enough", "look at the ATS", "easier than pulling it from the ATS"
- Cover-letter sludge: passionate, excited to contribute, great fit, leverage, utilize, I hope this finds you well, just reaching out
- Fake research: company metrics, "when I saw that you", Reddit, Glassdoor
- Resume bullets, tech lists, em-dashes, markdown, P.S., signing their name

LAYOUT:
Hi {First},

{paragraph}

{paragraph}

{question}

Thanks,

Formatter adds the signature. Do not write LinkedIn/phone/email.

THE ASK: use the exact style the payload gives for this recipient — it always asks for eyes on the application (or a pointer to whoever owns it), phrased so a stranger can say yes in one line or ignore it without guilt. Never "15 minutes of your time". Never "I'd love to chat". Never "let me know if you have any questions".

SUBJECT: "{role} - Kabir Narula"  (flat, not clever)

Copy this REGISTER (facts change per email, the warmth and plainness stay):

Subject: Software Developer - Kabir Narula

Hi Jose,

I applied for the entry-level Software Developer role at Konrad earlier this week, and figured a short note straight to a person was worth it.

I just graduated from Seneca in Toronto, and the posting's mention of internal tooling is basically my last year: at Seneca's research lab I built small Python/FastAPI services with GitHub Actions so deploys stopped breaking things, and my side project BetterMind is a journaling app whose companion actually remembers your past entries.

Any chance you could take a look at my application, or point me to whoever owns it?

Thanks,

---

Subject: Backend Engineer - Kabir Narula

Hi Devon,

Saw the Backend Engineer posting at Northline and applied last night.

I'm a recent Seneca grad. My main side project is VertexFlow, basically Git for 3D files: a Linux worker chews through the heavy mesh processing in a queue so the web app stays fast. github.com/Kabir-Narula/Vertex_flow if you want a look.

If the project sounds relevant, would you be open to passing my name to the hiring team?

Thanks,

Return JSON: {"subject":"...","body":"..."} with real newlines.`;

const FOLLOWUP_PROMPT = `You write a short follow-up as Kabir Narula (Seneca grad, August 2026, not a student) to someone who never replied. 3-4 sentences, 60-90 words. Warm and plain. No guilt, no apology theater, no new claims about work.

Hi {First},

Applied {N} days ago for {role} at {company}. Still interested, plus one honest sentence why: connect the JD line to something real of his, or skip the reason if nothing connects.

{the follow-up ask, one sentence, low pressure: eyes on the application — "Any chance my application could get a look?" or "Could you point me to whoever's reviewing it?"}

Thanks,

One human beat is fine ("figured one more note wouldn't hurt"), once, no groveling.
BANNED: circling back, touching base, gentle reminder, did you get my email, out of the blue, no need to reply, I know you're busy, em-dashes, markdown, P.S.
Subject: "following up - {role}". Return JSON.`;

export interface DraftInput {
  job: { title: string; company: string; description: string };
  contact: { name: string; role: string; email: string; why?: string } | null;
  research: CompanyResearch | null;
  projects: EmailProject[];
  hasFinalDocs: boolean;
  candidateName: string;
}

export function classifyRecipient(role: string | undefined | null): RecipientKind {
  const t = role ?? "";
  if (/university|campus|early[- ]career|new[- ]?grad|student program|emerging talent|graduate program/i.test(t)) {
    return "campus";
  }
  if (/engineering manager|hiring manager|director|head of|team lead|tech lead|\bvp\b|vice president|\bcto\b|founder|\bmanager\b/i.test(t)) {
    return "manager";
  }
  if (/software|engineer|developer|swe|programmer|architect/i.test(t)) return "engineer";
  if (/recruit|talent|sourcer|staffing|people ops|\bhr\b|human resources/i.test(t)) {
    return "recruiter";
  }
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
  const product = (research.product || "").trim();
  const hook = (research.hookFact || "").trim();
  const generic = /leading provider|world-class|cutting-edge|passionate about|innovative solutions/i;
  return {
    product: product && !generic.test(product) ? product : null,
    hookFact: hook && !generic.test(hook) && !/\d[\d,.]*\s*(billion|million|%|users|requests)/i.test(hook) ? hook : null,
    tone: research.tone ?? "casual",
  };
}

const CLOSE_BY_KIND: Record<RecipientKind, string> = {
  campus: 'Close with one of: "Could you take a look at my application?" / "Any chance my application could get a look?"',
  recruiter: 'Close with one of: "Could you take a look at my application?" / "Any chance my application could get a look?"',
  manager: 'Close with one of: "Any chance you could take a look at my application, or point me to whoever owns it?" / "If this isn\'t your desk, could you point me to whoever\'s reviewing it?"',
  engineer: 'Close with one of: "If the project sounds relevant, would you be open to passing my name to the hiring team?" / "Would you be open to a referral if the work looks relevant?"',
  unknown: 'Close with one of: "Could you take a look at my application, or point me to whoever reviews it?" / "Any chance my application could get a look?"',
};

const SIMPLE_QUESTION = "Could you take a look at my application?";
const COMMANDING_CLOSE =
  /appreciate a glance|when you have a chance|please take a look|grateful if you took a look|a glance when you have|i'd be grateful if you|easier than (pulling it from )?the ats|easier than the ats|15-minute|i'd love to (chat|connect)/i;
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
  opts: { signOff: string; recipientFirst: string | null; company: string }
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
  if (paras.length && (COMMANDING_CLOSE.test(paras[paras.length - 1]) || FAKE_HUMILITY.test(paras[paras.length - 1]))) {
    paras[paras.length - 1] = SIMPLE_QUESTION;
  }
  if (!paras.some((p) => /\?\s*$/.test(p))) paras.push(SIMPLE_QUESTION);
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

function fallbackDraft(input: DraftInput, _kind: RecipientKind, first: string | null): EmailDraft {
  const project = input.projects[0];
  const who = project
    ? `I just graduated from Seneca in Toronto. Lately I've been building ${project.name}: ${project.oneLiner.replace(/\.$/, "")}.`
    : "I just graduated from Seneca in Toronto (Software Development, August 2026).";
  const body = [
    first ? `Hi ${first},` : `Hi ${input.job.company} team,`,
    "",
    `I applied for ${input.job.title} at ${input.job.company} earlier this week, and figured a short note straight to a person was worth it.`,
    "",
    who,
    "",
    SIMPLE_QUESTION,
    "",
    "Thanks,",
    CANDIDATE.signOff,
  ].join("\n");
  return { subject: `${input.job.title} - ${CANDIDATE.fullName}`, body };
}

async function completeJson(system: string, user: unknown, tier: "quality" | "cheap"): Promise<EmailDraft | null> {
  try {
    const res = await openai().chat.completions.create({
      model: model(tier),
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = parseJson(res.choices[0]?.message?.content ?? "{}");
    const subject = typeof parsed.subject === "string" ? parsed.subject : "";
    const body = typeof parsed.body === "string" ? parsed.body : "";
    if (!body.trim()) return null;
    return { subject, body };
  } catch {
    // LLM down (quota/network) — caller falls back to the deterministic draft
    return null;
  }
}

function userPayload(input: DraftInput, extra: Record<string, unknown> = {}) {
  const first = recipientFirst(input.contact);
  const kind = classifyRecipient(input.contact?.role);
  return {
    write_as: CANDIDATE,
    never_call_him_a_student: true,
    recipient: input.contact
      ? {
          firstName: first,
          fullName: input.contact.name,
          role: input.contact.role,
          kind,
          whyThisInbox: input.contact.why ?? CLOSE_BY_KIND[kind],
          greeting: first ? `Hi ${first},` : `Hi ${input.job.company} team,`,
        }
      : { kind: "unknown" as const, greeting: `Hi ${input.job.company} team,`, whyThisInbox: CLOSE_BY_KIND.unknown },
    job: { title: input.job.title, company: input.job.company },
    role_in_one_line: input.job.description.replace(/\s+/g, " ").trim().slice(0, 400),
    company_research_use_if_real: researchForEmail(input.research),
    connect_him_to_the_role:
      "Tie ONE real thing about him (project or internship) to ONE real thing in role_in_one_line or the company research. If nothing honestly connects, skip the connection and use one project in spoken English.",
    talk_about_at_most_one_of_these_projects: input.projects,
    already_applied_online: true,
    close_with_the_ask_that_fits_this_recipient: CLOSE_BY_KIND[kind],
    sign_off_exactly: "Thanks,",
    spacing: "one blank line between greeting / paragraphs / Thanks. Do not write a signature; the formatter appends full name, email, phone, LinkedIn, GitHub.",
    ...extra,
  };
}

export async function draftOutreachEmail(input: DraftInput): Promise<EmailDraft> {
  const first = recipientFirst(input.contact);
  const kind = classifyRecipient(input.contact?.role);
  const generated = await completeJson(SYSTEM_PROMPT, userPayload(input), "quality");
  const raw = generated ?? fallbackDraft(input, kind, first);
  if (!raw.subject.trim()) {
    raw.subject = `${input.job.title} - ${CANDIDATE.fullName}`;
  }
  return polishEmail(raw, { signOff: CANDIDATE.signOff, recipientFirst: first, company: input.job.company });
}

/** Follow-up nudge N days after applying with no response. */
export async function draftFollowUpEmail(input: DraftInput & { daysSinceApplied: number }): Promise<EmailDraft> {
  const first = recipientFirst(input.contact);
  const generated = await completeJson(
    FOLLOWUP_PROMPT,
    userPayload(input, { days_since_applied: input.daysSinceApplied, do_not_invent_new_work: true }),
    "quality"
  );
  const raw =
    generated ??
    ({
      subject: `following up - ${input.job.title}`,
      body: [
        first ? `Hi ${first},` : `Hi ${input.job.company} team,`,
        "",
        `Applied about ${input.daysSinceApplied} days ago for ${input.job.title}. Still interested.`,
        "",
        SIMPLE_QUESTION,
        "",
        "Thanks,",
        CANDIDATE.signOff,
      ].join("\n"),
    } satisfies EmailDraft);
  if (!raw.subject.trim()) raw.subject = `following up - ${input.job.title}`;
  return polishEmail(raw, { signOff: CANDIDATE.signOff, recipientFirst: first, company: input.job.company });
}
