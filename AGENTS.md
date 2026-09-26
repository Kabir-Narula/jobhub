<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project notes (jobhub)

Single-user job aggregation + application tracking + LaTeX resume tailoring. See README.md for setup.

- Next.js 16: `proxy.ts` (not middleware.ts), all request APIs async (`await params`, `await cookies()`).
- shadcn/ui here uses **Base UI** primitives (not Radix): `<Button render={<Link/>} nativeButton={false}>` instead of `asChild`, Select `onValueChange` receives `string | null`.
- Theme: warm-paper light, tokens in `app/globals.css` (accent `#c2410c`); display font Space Grotesk via `--font-space-grotesk` (`font-display` class).
- Prisma 6 (pinned; v7 has breaking changes). CLI reads `.env` only; Next reads `.env.local` — DB creds live in both.
- `lib/tailor/latex.ts` is the design lock: masters are parsed into frozen segments; the LLM produces JSON only; the assembler re-injects. Never let the LLM emit LaTeX.
- Tailoring v3: bullets written from scratch (3/entry), titles optimized by default (route `allowTitleChanges` defaults true), skills re-ranked within master vocabulary, best-2 projects from `lib/tailor/projects.ts` (grounded in the real repos). Fabrication tripwire = `findNewNumbers` (punctuation-normalized).
- JD analysis (`lib/tailor/jd-analysis.ts`): every generation starts from a structured read of the posting — deterministic section parse (Requirements vs Nice-to-have vs boilerplate) + cheap-tier labels (domain, work types, posting seniority), cached on `Job.jdAnalysis`. Scoring weights must-haves 3x; the ATS boost fires on score <70 OR any uncovered must-have; uncovered must-haves join the repair pass via `coverageIssues`. `match.ts` strips `\hypersetup` metadata before scoring, requires same-sentence proximity for multi-word terms, and drops never-invent vendors (SuccessFactors/Tableau/SAS…) from claimable terms on business postings — never re-add vendor-to-generic-word coverage mappings. Lens suppression governs emphasis only: JD-named terms are exempt on engineering resumes.
- Master skills labels are canonical: `Languages` / `Infra & Tools` / `Frameworks` / `Cloud & Data` (`scripts/patch-master-skills-labels.ts`). JD_TECH_HOME and skills-extra assume exactly these.
- `normalizeForTectonic()` must be applied to any master .tex at import time (seed + `/api/masters`).
- `fixEmptyLineBreaks()` runs inside `compileLatex` — required for masters that pdfLaTeX tolerated but XeTeX halts on.
- Source adapters: `lib/sources/*`, one shared `NormalizedJob` schema; failures isolated per source in `lib/poll.ts`. LinkedIn best-effort (disable `LINKEDIN_ADAPTER=off`). Workday: `limit` hard-capped at 20 by the API; boardToken = `host/tenant/site`.
- LLM: two tiers via `OPENAI_MODEL` (quality: main resume pass + all refinement passes, company research, interview prep, outreach email) and `OPENAI_MODEL_MINI` (cheap: JD-analysis labels, contact names). Any OpenAI-compatible API (`OPENAI_BASE_URL`; Kimi = `https://api.kimi.com/coding/v1` + `k3`). gpt-5.x rejects custom `temperature` — don't set it. `parseJson()` in research.ts tolerates ```json fenced replies. Email voice lives in `lib/tailor/email.ts` (spoken project one-liners, recipient-kind ask, polish pass).
- Contacts: `lib/contacts/hunter.ts` (Hunter.io domain-search + verifier, role-ranked). Cached per company (sibling jobs reuse) to conserve the 25/month free quota. Route: `/api/contacts/find`.
- Verify changes with `npx tsc --noEmit`, `npx eslint .`, `npx tsx scripts/test-compile.ts`, `npx tsx scripts/test-tailor.ts` (fill % + frozen sections), and `node scripts/e2e-ui.mjs` (dev server running). Free deterministic suites (no LLM/DB cost): `test-match`, `test-jd-analysis`, `test-bullet-quality`, `test-tailor-quality`, `test-hr-tech`, `test-zs`, `test-hiring-screen`, `test-role-family`, `test-projects`, `test-analyst-techniques`, `test-email-voice`, `test-dedupe`.

