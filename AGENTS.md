<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project notes (jobhub)

Single-user job aggregation + application tracking + LaTeX resume tailoring. See README.md for setup.

- Next.js 16: `proxy.ts` (not middleware.ts), all request APIs async (`await params`, `await cookies()`).
- shadcn/ui here uses **Base UI** primitives (not Radix): `<Button render={<Link/>} nativeButton={false}>` instead of `asChild`, Select `onValueChange` receives `string | null`.
- Theme: anti-design / neo-brutalism — soft-bone grid background, ink 2px borders, zero radius, hard offset shadows (`shadow-hard*`), ink `#0f0f12` primary actions, IKB `#2137ff` signature accent + links, lavender `#e9e6ff` highlight, deep-teal `#0f766e` success, `stamp`/`tilt-*` utilities; display font Space Grotesk via `--font-space-grotesk` (`font-display` class).
- Prisma 6 (pinned; v7 has breaking changes). CLI reads `.env` only; Next reads `.env.local` — DB creds live in both.
- `lib/tailor/latex.ts` is the design lock: masters are parsed into frozen segments; the LLM produces JSON only; the assembler re-injects. Never let the LLM emit LaTeX.
- Tailoring v3: bullets written from scratch (3/entry), titles optimized by default (route `allowTitleChanges` defaults true), skills re-ranked within master vocabulary, best-2 projects from `lib/tailor/projects.ts` (grounded in the real repos). Fabrication tripwire = `findNewNumbers` (punctuation-normalized); AI-register backstop = `polishBullet` (cuts trailing purpose-clause tails + self-applied JD adjectives deterministically). ATS scoring/boost run on `claimableJdTerms` only (tech terms + skill-head phrases — JD attitude words like "excited"/"forward thinking" never reach the score or the prompt). Skills items carry canonical labels (`skills-extra.ts`), enforced at assembly.
- `normalizeForTectonic()` must be applied to any master .tex at import time (seed + `/api/masters`).
- `fixEmptyLineBreaks()` runs inside `compileLatex` — required for masters that pdfLaTeX tolerated but XeTeX halts on.
- Source adapters: `lib/sources/*`, one shared `NormalizedJob` schema; failures isolated per source in `lib/poll.ts`. LinkedIn best-effort (disable `LINKEDIN_ADAPTER=off`). Workday: `limit` hard-capped at 20 by the API; boardToken = `host/tenant/site`.
- LLM: two tiers via `OPENAI_MODEL` (quality: main resume pass, ATS boost, outreach email) and `OPENAI_MODEL_MINI` (cheap: research, shorten/expand, contacts). Any OpenAI-compatible API (`OPENAI_BASE_URL`; Kimi = `https://api.kimi.com/coding/v1` + `k3`). gpt-5.x rejects custom `temperature` — don't set it. `parseJson()` in research.ts tolerates ```json fenced replies. Email voice lives in `lib/tailor/email.ts` (balanced stranger-aware voice: role-connected middle line, recipient-kind ask rotation, polish pass).
- Contacts: `lib/contacts/hunter.ts` (Hunter.io domain-search + verifier, role-ranked). Cached per company (sibling jobs reuse) to conserve the 25/month free quota. Route: `/api/contacts/find`.
- Manual job intake: `POST /api/jobs/add` + `lib/jobs/from-url.ts` — paste a posting URL and it resolves fields with NO LLM: board JSON APIs (Greenhouse/Lever/Ashby/SmartRecruiters/Workday cxs/LinkedIn guest) → JSON-LD JobPosting → og/meta heuristics. LLM is never used; failures return a clean 422 pointing at the paste-details mode. Manual adds never get geo-dropped (bucket falls back to REMOTE/TORONTO). Test: `npx tsx scripts/test-add-url.ts`.
- Verify changes with `npx tsc --noEmit`, `npx eslint .`, `npx tsx scripts/test-compile.ts`, `npx tsx scripts/test-tailor.ts` (fill % + frozen sections), and `node scripts/e2e-ui.mjs` (dev server running).

