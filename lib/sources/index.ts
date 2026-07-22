import { prisma } from "@/lib/db";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { smartRecruitersAdapter } from "./smartrecruiters";
import { workdayAdapter } from "./workday";
import { remotiveAdapter } from "./remotive";
import { remoteOkAdapter } from "./remoteok";
import { weWorkRemotelyAdapter } from "./weworkremotely";
import { adzunaAdapter } from "./adzuna";
import { simplifyAdapters } from "./simplify";
import { linkedinAdapter } from "./linkedin";
import { amazonAdapter } from "./amazon";
import type { SourceAdapter } from "./types";

/**
 * Build the full adapter list: one adapter per enabled CompanySource row,
 * plus the static remote boards. JSearch/RapidAPI is intentionally NOT
 * implemented (ToS gray area per spec). LinkedIn/Indeed scraping: not built.
 */
export async function buildSources(): Promise<SourceAdapter[]> {
  const sources: SourceAdapter[] = [];

  const companies = await prisma.companySource.findMany({ where: { enabled: true } });
  for (const c of companies) {
    switch (c.atsType) {
      case "GREENHOUSE":
        sources.push(greenhouseAdapter(c.boardToken, c.name));
        break;
      case "LEVER":
        sources.push(leverAdapter(c.boardToken, c.name));
        break;
      case "ASHBY":
        sources.push(ashbyAdapter(c.boardToken, c.name));
        break;
      case "SMARTRECRUITERS":
        sources.push(smartRecruitersAdapter(c.boardToken, c.name));
        break;
      case "WORKDAY":
        sources.push(workdayAdapter(c.boardToken, c.name));
        break;
    }
  }

  sources.push(remotiveAdapter(), remoteOkAdapter(), weWorkRemotelyAdapter());

  // Amazon's own jobs API (rich data: new-grad flags, full descriptions).
  sources.push(amazonAdapter());

  // Simplify community lists (GitHub) — great new-grad coverage.
  sources.push(...simplifyAdapters());

  // BEST-EFFORT: LinkedIn guest API. Optional and isolated — rate limiting
  // here never affects the other sources. Disable by commenting this line out.
  if (process.env.LINKEDIN_ADAPTER !== "off") {
    sources.push(linkedinAdapter());
  }

  const adzuna = adzunaAdapter();
  if (adzuna) sources.push(adzuna);

  return sources;
}
