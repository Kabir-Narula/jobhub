---
name: debug-tailoring
description: Debugs resume and cover PDF generation — Tectonic compile, one-page fill, frozen segments, fabrication numbers. Use when PDFs fail, overflow to two pages, fill percent is wrong, or bullets look fabricated.
---

# Debug tailoring

1. Read `lib/tailor/latex.ts` and the failing script output. Do not redesign the assembler.
2. Reproduce with `npx tsx scripts/test-compile.ts` and `npx tsx scripts/test-tailor.ts`.
3. Check, in order: `normalizeForTectonic`, `fixEmptyLineBreaks`, `findNewNumbers`, `polishBullet`, `claimableJdTerms`.
4. LLM output stays JSON. Fix the prompt or assembler — never emit LaTeX from the model.
5. Skills stay in the master vocabulary plus `lib/tailor/skills-extra.ts`. Projects come from `lib/tailor/projects.ts`.
6. Email drafts: `lib/tailor/email.ts` only. No metric-hook, resume bullets, or P.S.

For a long session, attach this skill as a Custom Mode (`Alt+Enter` after `/debug-tailoring`).
