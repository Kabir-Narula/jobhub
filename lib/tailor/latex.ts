/**
 * Master-template parser + assembler.
 *
 * The LLM never sees or writes LaTeX structure. The master .tex is parsed
 * once into frozen segments (preamble, heading, education, projects, skills,
 * and all Experience scaffolding: company/location/dates) plus the mutable
 * parts (experience bullet text, cover-letter addressee + body). Assembly
 * re-injects new content into the exact frozen skeleton, so design, section
 * order, education, projects, and company names cannot change — by construction.
 */

import { extraSkillsPool } from "./skills-extra";

// ---------- engine compatibility ----------

/**
 * pdfLaTeX-only primitives (\input{glyphtounicode}, \pdfgentounicode) are
 * undefined under XeTeX/Tectonic. Guard them so masters compile on both
 * engines. Output is identical under pdfLaTeX; under XeTeX ToUnicode maps
 * are embedded anyway. Applied at import time (seed + re-upload).
 */
export function normalizeForTectonic(tex: string): string {
  return tex
    .replace(/^[ \t]*\\input\{glyphtounicode\}[ \t]*$/m, "\\ifdefined\\pdfgentounicode\n  \\input{glyphtounicode}\n\\fi")
    .replace(/^[ \t]*\\pdfgentounicode=1[ \t]*$/m, "\\ifdefined\\pdfgentounicode\n  \\pdfgentounicode=1\n\\fi")
    .replace(
      /^[ \t]*\\usepackage\[T1\]\{fontenc\}[ \t]*$/m,
      "\\ifdefined\\XeTeXversion\n  % XeTeX maps Unicode directly; Latin Modern via fontspec keeps identical metrics\n  \\usepackage{fontspec}\n\\else\n  \\usepackage[T1]{fontenc}\n\\fi"
    );
}

// ---------- LaTeX escaping (LLM content is plain text) ----------

export function escapeLatex(s: string): string {
  return s
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

// ---------- brace-aware group reading ----------

/** s[start] must be '{'. Returns [content, indexAfterClosingBrace]. */
function readGroup(s: string, start: number): [string, number] {
  if (s[start] !== "{") throw new Error(`expected '{' at ${start}, got '${s[start]}'`);
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      i++; // skip escaped char
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return [s.slice(start + 1, i), i + 1];
    }
  }
  throw new Error("unbalanced braces in master template");
}

/** Read the n consecutive brace groups of a command starting at cmdEnd (skipping whitespace/newlines). */
function readGroups(s: string, from: number, n: number): [string[], number] {
  const groups: string[] = [];
  let i = from;
  for (let k = 0; k < n; k++) {
    while (i < s.length && /\s/.test(s[i])) i++;
    const [g, next] = readGroup(s, i);
    groups.push(g);
    i = next;
  }
  return [groups, i];
}

// ---------- Resume ----------

export interface ExperienceEntry {
  company: string; // frozen
  location: string; // frozen
  title: string; // mutable ONLY with explicit user confirmation
  dates: string; // frozen
  bullets: string[]; // mutable content
}

export interface ParsedResume {
  /** Everything before the first \resumeSubheading of the Experience section. */
  before: string;
  entries: ExperienceEntry[];
  /** Everything after the last \resumeItemListEnd of the Experience section. */
  after: string;
  /** Master's line ending, preserved so untouched lines stay byte-identical. */
  nl: string;
}

export function parseResume(tex: string): ParsedResume {
  const expIdx = tex.indexOf("\\section{Experience}");
  if (expIdx < 0) throw new Error("No \\section{Experience} found in master resume");
  const nl = tex.includes("\r\n") ? "\r\n" : "\n";

  const entries: ExperienceEntry[] = [];
  let before = "";
  let after = "";
  let cursor = expIdx;
  let lastEnd = -1;

  while (true) {
    const subIdx = tex.indexOf("\\resumeSubheading", cursor);
    if (subIdx < 0) break;
    const [groups, afterHead] = readGroups(tex, subIdx + "\\resumeSubheading".length, 4);
    const listStart = tex.indexOf("\\resumeItemListStart", afterHead);
    const listEnd = tex.indexOf("\\resumeItemListEnd", listStart);
    if (listStart < 0 || listEnd < 0) throw new Error("Malformed experience entry in master resume");

    const bullets: string[] = [];
    let bCursor = listStart + "\\resumeItemListStart".length;
    while (true) {
      const itemIdx = tex.indexOf("\\resumeItem", bCursor);
      if (itemIdx < 0 || itemIdx >= listEnd) break;
      const [content] = readGroup(tex, itemIdx + "\\resumeItem".length);
      bullets.push(content);
      bCursor = itemIdx + "\\resumeItem".length + content.length + 2;
    }

    if (entries.length === 0) before = tex.slice(0, subIdx);
    entries.push({ company: groups[0], location: groups[1], title: groups[2], dates: groups[3], bullets });
    lastEnd = listEnd + "\\resumeItemListEnd".length;
    cursor = lastEnd;
  }

  if (entries.length === 0) throw new Error("No \\resumeSubheading entries found");
  after = tex.slice(lastEnd);
  return { before, entries, after, nl };
}

export interface ResumeUpdate {
  /** New title (already confirmation-gated by the caller); undefined = keep frozen original. */
  title?: string;
  /** Replacement bullets as PLAIN TEXT (escaped here). Count is clamped to the original. */
  bullets?: string[];
}

export function assembleResume(parsed: ParsedResume, updates: ResumeUpdate[], maxBullets = 4): string {
  const nl = parsed.nl;
  let out = parsed.before.replace(/[ \t]+$/, "");
  parsed.entries.forEach((e, i) => {
    const u = updates[i];
    const title = u?.title !== undefined ? escapeLatex(u.title) : e.title;
    // Untouched entries keep their bullets byte-for-byte; LLM bullets are plain text and get escaped.
    let bullets: string[];
    if (u?.bullets && u.bullets.length > 0) {
      bullets = u.bullets.slice(0, maxBullets).map(escapeLatex);
      while (bullets.length < Math.min(2, e.bullets.length)) {
        bullets.push(e.bullets[bullets.length]);
      }
    } else {
      bullets = [...e.bullets].slice(0, maxBullets);
    }
    out += `    \\resumeSubheading${nl}      {${e.company}}{${e.location}}${nl}      {${title}}{${e.dates}}${nl}`;
    out += `      \\resumeItemListStart${nl}`;
    for (const b of bullets) out += `        \\resumeItem{${b}}${nl}`;
    out += `      \\resumeItemListEnd${nl}${nl}`;
  });
  // 'after' starts with the blank line(s) that followed the last entry; trim leading blank lines we re-added.
  out += parsed.after.replace(/^\s*\r?\n/, "");
  return out;
}

// ---------- Cover letter ----------

export interface ParsedCover {
  /** Up to the addressee block (preamble, heading, date). Frozen. */
  prefix: string;
  /** Between addressee block and the salutation (spacing + BODY comment). Frozen. */
  mid: string;
  /** "\noindent Dear Hiring Manager, \\" — frozen salutation line. */
  salutation: string;
  /** From the closing \vspace before "Sincerely" to \end{document}. Frozen. */
  suffix: string;
  /** Master addressee values (for reference/defaults). */
  addressee: { company: string; city: string; role: string };
  /** Master body paragraphs (plain text). */
  bodyParagraphs: string[];
  /** Master's line ending, preserved so untouched lines stay byte-identical. */
  nl: string;
}

export function parseCover(tex: string): ParsedCover {
  const addrStart = tex.indexOf("\\textbf{Hiring Manager}");
  if (addrStart < 0) throw new Error("Cover master: addressee block not found");
  const [addrGroups, addrEnd] = readGroups(tex, addrStart + "\\textbf".length, 1);

  // Master layout: \textbf{Hiring Manager} \\ <Company> \\ <City> \\ \\ \textbf{RE: <Role>} \\
  const addrBlockEnd = tex.indexOf("\\vspace", addrEnd);
  const addrBlock = tex.slice(addrEnd, addrBlockEnd);
  const lines = addrBlock
    .split(/\\\\/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  let company = "";
  let city = "";
  let role = "";
  const reIdx = lines.findIndex((l) => l.startsWith("\\textbf{RE:"));
  const plain = lines.filter((l) => !l.startsWith("\\textbf"));
  company = plain[0] ?? "";
  city = plain[1] ?? "";
  if (reIdx >= 0) {
    const m = lines[reIdx].match(/\\textbf\{RE:\s*(.*?)\}/);
    role = m?.[1] ?? "";
  }
  void addrGroups;

  const dearIdx = tex.indexOf("\\noindent Dear");
  if (dearIdx < 0) throw new Error("Cover master: salutation not found");
  const dearLineEnd = tex.indexOf("\\\\", dearIdx);
  const salutation = tex.slice(dearIdx, dearLineEnd + 2);

  const closeIdx = tex.indexOf("\\vspace{0.2in}", dearLineEnd);
  if (closeIdx < 0) throw new Error("Cover master: closing spacing not found");

  const bodyRaw = tex.slice(dearLineEnd + 2, closeIdx);
  const bodyParagraphs = bodyRaw
    .split("\\vspace{0.1in}")
    .map((p) => p.replace(/\\noindent/g, "").replace(/\\\\\s*$/, "").trim())
    .filter((p) => p.length > 0);

  return {
    prefix: tex.slice(0, addrStart),
    mid: tex.slice(addrBlockEnd, dearIdx),
    salutation,
    suffix: tex.slice(closeIdx),
    addressee: { company, city, role },
    bodyParagraphs,
    nl: tex.includes("\r\n") ? "\r\n" : "\n",
  };
}

export interface CoverUpdate {
  addresseeCompany: string;
  addresseeCity: string;
  role: string;
  bodyParagraphs: string[]; // plain text
}

export function assembleCover(parsed: ParsedCover, u: CoverUpdate): string {
  const nl = parsed.nl;
  let out = parsed.prefix;
  out += `\\textbf{Hiring Manager} \\\\${nl}${escapeLatex(u.addresseeCompany)} \\\\${nl}${escapeLatex(u.addresseeCity)} \\\\${nl}\\\\${nl}\\textbf{RE: ${escapeLatex(u.role)}} \\\\${nl}${nl}`;
  out += parsed.mid;
  out += parsed.salutation;
  const paras = u.bodyParagraphs.filter((p) => p.trim().length > 0);
  paras.forEach((p, i) => {
    const last = i === paras.length - 1;
    out += `${nl}${nl}\\vspace{0.1in}${nl}${nl}\\noindent ${escapeLatex(p.trim())}${last ? " \\\\" : ""}`;
  });
  out += nl + nl + parsed.suffix;
  return out;
}

// ---------- Projects section (choose-2 library injection) ----------

export interface ProjectsSection {
  /** Everything from end of Experience section to the first \resumeProjectHeading. */
  before: string;
  /** Everything after the last \resumeItemListEnd of the Projects section. */
  after: string;
  count: number;
  nl: string;
}

export function parseProjectsSection(tex: string): ProjectsSection {
  const nl = tex.includes("\r\n") ? "\r\n" : "\n";
  const secIdx = tex.indexOf("\\section{Projects}");
  if (secIdx < 0) throw new Error("No \\section{Projects} found in master resume");
  const firstHead = tex.indexOf("\\resumeProjectHeading", secIdx);
  if (firstHead < 0) throw new Error("No \\resumeProjectHeading found");

  let count = 0;
  let lastEnd = -1;
  let cursor = firstHead;
  while (true) {
    const headIdx = tex.indexOf("\\resumeProjectHeading", cursor);
    if (headIdx < 0) break;
    const listEnd = tex.indexOf("\\resumeItemListEnd", headIdx);
    if (listEnd < 0) break;
    count++;
    lastEnd = listEnd + "\\resumeItemListEnd".length;
    cursor = lastEnd;
  }

  return {
    before: tex.slice(0, firstHead),
    after: tex.slice(lastEnd),
    count,
    nl,
  };
}

export interface ProjectEntry {
  name: string;
  githubUrl: string;
  techLine: string;
  year: string;
  bullets: string[]; // plain text
}

/** Rebuilds the Projects section in the master's exact macro format. */
export function assembleProjectsSection(section: ProjectsSection, entries: ProjectEntry[], maxBullets = 0): string {
  const nl = section.nl;
  let out = section.before;
  entries.forEach((p, i) => {
    const bullets = maxBullets > 0 ? p.bullets.slice(0, maxBullets) : p.bullets;
    out += `    \\resumeProjectHeading${nl}`;
    out += `      {\\textbf{${escapeLatex(p.name)}} $|$ \\href{${p.githubUrl}}{\\underline{GitHub}} $|$ \\emph{${escapeLatex(p.techLine)}}}{${escapeLatex(p.year)}}${nl}`;
    out += `      \\resumeItemListStart${nl}`;
    for (const b of bullets) out += `        \\resumeItem{${escapeLatex(b)}}${nl}`;
    out += `      \\resumeItemListEnd${nl}`;
    if (i < entries.length - 1) out += nl;
  });
  out += nl + section.after.replace(/^\s*\r?\n/, "");
  return out;
}

// ---------- Skills section (re-rank only, closed vocabulary) ----------

export interface SkillsSection {
  before: string;
  after: string;
  lines: { label: string; items: string[] }[];
  nl: string;
}

export function parseSkillsSection(tex: string): SkillsSection {
  const nl = tex.includes("\r\n") ? "\r\n" : "\n";
  const secIdx = tex.indexOf("\\section{Technical");
  if (secIdx < 0) throw new Error("No Technical Skills section found in master resume");
  const itemizeStart = tex.indexOf("\\begin{itemize}", secIdx);
  const itemizeEnd = tex.indexOf("\\end{itemize}", itemizeStart);
  if (itemizeStart < 0 || itemizeEnd < 0) throw new Error("Malformed skills section");

  const block = tex.slice(itemizeStart, itemizeEnd);
  const lines: { label: string; items: string[] }[] = [];
  const re = /\\textbf\{([^{}]*)\}\{:\s*([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const label = m[1];
    const items = m[2]
      .replace(/\\\\\s*$/, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    lines.push({ label, items });
  }
  if (lines.length === 0) throw new Error("No skills lines parsed");

  return {
    before: tex.slice(0, itemizeStart),
    after: tex.slice(itemizeEnd),
    lines,
    nl,
  };
}

/** Master skills as a flat closed vocabulary (for validating LLM output). */
export function skillsVocabulary(section: SkillsSection): Set<string> {
  return new Set(section.lines.flatMap((l) => l.items.map((i) => i.toLowerCase())));
}

/**
 * Rebuilds the skills block. Items are validated against the master's
 * vocabulary PLUS the verified extra-skills pool (repos/coursework) —
 * the LLM may re-rank and select, never invent. Original casing restored.
 */
export function assembleSkillsSection(
  section: SkillsSection,
  update: { label: string; items: string[] }[] | null,
  maxItemsPerLine = 0,
  suppress: string[] = []
): string {
  const nl = section.nl;
  const canon = new Map<string, string>();
  for (const l of section.lines) for (const i of l.items) canon.set(i.toLowerCase(), i);
  // widen the pool with verified extras (emitted LaTeX-escaped; master items
  // are already escaped in the master itself)
  for (const i of extraSkillsPool()) {
    if (!canon.has(i.toLowerCase())) canon.set(i.toLowerCase(), escapeLatex(i));
  }
  const suppressSet = new Set(suppress.map((s) => s.toLowerCase()));

  const lines = section.lines.map((orig) => {
    const u = update?.find((x) => x.label.replace(/\\&/g, "&") === orig.label.replace(/\\&/g, "&"));
    let items = orig.items;
    if (u && Array.isArray(u.items) && u.items.length > 0) {
      const validated = u.items
        .map((i) => canon.get(i.trim().toLowerCase()))
        .filter((x): x is string => Boolean(x));
      if (validated.length > 0) items = validated;
    }
    // lens suppression: real but irrelevant tech stays off for this posting
    items = items.filter((i) => {
      const plain = i.replace(/\\([&%$#_{}])/g, "$1").toLowerCase();
      for (const s of suppressSet) if (plain.includes(s)) return false;
      return true;
    });
    if (items.length === 0) items = orig.items.filter((i) => !suppressSet.has(i.toLowerCase()));
    if (items.length === 0) items = orig.items;
    if (maxItemsPerLine > 0) items = items.slice(0, maxItemsPerLine);
    return `      \\textbf{${orig.label}}{: ${items.join(", ")} \\\\}`;
  });

  let out = section.before;
  out += `\\begin{itemize}[leftmargin=0.15in, label={}]${nl}`;
  out += `    \\small{\\item{${nl}`;
  out += lines.join(nl);
  out += `${nl}    }}${nl}`;
  out += `  ${section.after.trimStart()}`;
  return out;
}

// ---------- Achievements section (deterministic insert, design-consistent) ----------

/**
 * Appends an Achievements section before \end{document}, using the master's
 * own macros (\resumeItem) so the design stays identical. Items must already
 * be LaTeX-safe (they come from the curated achievements library).
 */
export function insertAchievements(tex: string, items: string[]): string {
  if (items.length === 0) return tex;
  const nl = tex.includes("\r\n") ? "\r\n" : "\n";
  const endIdx = tex.lastIndexOf("\\end{document}");
  if (endIdx < 0) throw new Error("No \\end{document} found");

  let section = `%-----------ACHIEVEMENTS-----------${nl}\\section{Achievements}${nl}  \\resumeItemListStart${nl}`;
  for (const item of items) {
    section += `    \\resumeItem{${item}}${nl}`;
  }
  section += `  \\resumeItemListEnd${nl}${nl}`;

  return tex.slice(0, endIdx) + section + tex.slice(endIdx);
}
