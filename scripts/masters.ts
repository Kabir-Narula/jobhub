import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { normalizeForTectonic } from "../lib/tailor/latex";

/**
 * Load the master templates the way the app actually does.
 *
 * `MasterTemplate` in Postgres is the runtime source of truth (see
 * app/api/tailor/generate/route.ts). The `.tex` files one level above the repo
 * are only bootstrap fixtures for `prisma/seed.ts` and are not in git, so a
 * test that reads them exclusively fails on any fresh clone.
 *
 * Order: database first, then the seed fixtures, then a clear error.
 */
export interface Masters {
  resumeTex: string;
  coverTex: string;
  source: "database" | "files";
}

function fromFiles(): Masters | null {
  const resume = path.join(process.cwd(), "..", "Resume.tex");
  const cover = path.join(process.cwd(), "..", "cover.tex");
  if (!existsSync(resume) || !existsSync(cover)) return null;
  return {
    resumeTex: normalizeForTectonic(readFileSync(resume, "utf8")),
    coverTex: normalizeForTectonic(readFileSync(cover, "utf8")),
    source: "files",
  };
}

export async function loadMasters(): Promise<Masters> {
  if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      const [resume, cover] = await Promise.all([
        prisma.masterTemplate.findFirst({ where: { kind: "RESUME", active: true } }),
        prisma.masterTemplate.findFirst({ where: { kind: "COVER", active: true } }),
      ]);
      if (resume && cover) {
        return {
          resumeTex: normalizeForTectonic(resume.texContent),
          coverTex: normalizeForTectonic(cover.texContent),
          source: "database",
        };
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  const files = fromFiles();
  if (files) return files;

  throw new Error(
    "No masters found. Either seed the database (npm run db:seed) or place " +
      "Resume.tex and cover.tex in the directory above job-hub."
  );
}
