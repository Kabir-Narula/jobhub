---
name: add-source-adapter
description: Adds a job source adapter using SourceAdapter and NormalizedJob. Use when adding Greenhouse, Lever, Ashby, SmartRecruiters, Workday, or remote-board sources, or wiring CompanySource.
---

# Add source adapter

1. Read `lib/sources/types.ts` and one similar adapter in `lib/sources/`.
2. Implement `SourceAdapter.fetch()` in a new file. Throw on failure — `lib/poll.ts` isolates errors.
3. Register in `lib/sources/index.ts`. Add `AtsType` in `prisma/schema.prisma` only for company-board ATS types.
4. Do not add LinkedIn login scraping, Indeed login scraping, or JSearch/RapidAPI.
5. Workday: `limit` hard-capped at 20; `boardToken` is `host/tenant/site`.
6. Keep returning `NormalizedJob[]`. Do not invent a parallel job schema.
7. Verify with `npx tsc --noEmit`. Poll against the live DB only if the user asks.
