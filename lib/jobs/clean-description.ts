/**
 * Page-scraped postings (meta-heuristic parse, generic hydrate) carry the
 * careers site's nav menu, language switcher, share buttons and footer. That
 * chrome pushes the real posting past every "first N chars" heuristic
 * (role family, JD analysis) and wastes prompt tokens. Keep the posting body.
 */

const BODY_START =
  /^(job (details|description|summary)|about (the|this) (role|job|position|opportunity)|(the |your )?(role|job|position)( overview| summary)?:?$|your (job|role|team)|what you('| wi)ll do|responsibilities|key responsibilities|overview|a career as)\b/i;

const FOOTER =
  /^(share this (job|posting)|join our talent community|similar jobs|related jobs|view location on the map|why work at|discover our culture|access your profile|sign up to get|follow us|all rights reserved|©|&copy;|privacy policy|terms of use|cookie (policy|settings)|back to (top|search|jobs))/i;

const CHROME_LINE =
  /^(skip to (main )?content|current language|english( - [a-z]{2})?|fran[cç]ais|my profile|main menu.*|log ?in|sign ?in|sign up|apply( now)?|search jobs|all jobs|home( page)?|menu|share|x|facebook|linkedin|email|twitter|instagram|youtube|print|save job|\|)$/i;

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export function cleanJobDescription(raw: string): string {
  const text = String(raw ?? "").replace(/\r\n/g, "\n");
  if (text.length < 600) return text.trim();
  const lines = text.split("\n").map((l) => l.trim());

  let start = lines.findIndex((l) => BODY_START.test(l));
  if (start < 0) start = lines.findIndex((l) => wordCount(l) >= 14);
  if (start < 0) start = 0;

  const bodyChars = lines.slice(start).join("\n").length;
  let end = lines.length;
  let seen = 0;
  for (let i = start; i < lines.length; i++) {
    seen += lines[i].length + 1;
    if (seen > bodyChars * 0.35 && FOOTER.test(lines[i])) {
      end = i;
      break;
    }
  }

  const kept = lines
    .slice(start, end)
    .filter((l) => !CHROME_LINE.test(l))
    .join("\n")
    .replace(/&amp;/g, "&")
    .replace(/&copy;/g, "©")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Never trade a real posting for a fragment.
  return kept.length >= Math.min(800, text.length * 0.25) ? kept : text.trim();
}
