---
name: verify-jobhub
description: Runs jobhub verification in order — tsc, eslint, compile, tailor, optional e2e. Use when finishing a change, before a commit, or when the user asks to verify, typecheck, lint, or test.
---

# Verify jobhub

Run from `job-hub/`. Stop on the first failure. Do not invent Jest/Vitest or a second test runner.

1. `npx tsc --noEmit`
2. `npx eslint .`
3. If `lib/tailor/**`, tailor API routes, or master `.tex` changed: `npx tsx scripts/test-compile.ts` then `npx tsx scripts/test-tailor.ts`
4. If URL intake changed: `npx tsx scripts/test-add-url.ts`
5. If UI or app routes changed **and** `npm run dev` is already running: `node scripts/e2e-ui.mjs`

Do not start a second dev server. Do not print `.env` files while debugging failures.
