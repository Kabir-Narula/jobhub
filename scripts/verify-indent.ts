import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { insertAchievements } from "../lib/tailor/latex";
import { ACHIEVEMENTS } from "../lib/tailor/achievements";
import { compileLatex } from "../lib/tailor/compile";

const p = new PrismaClient();

/** Measure bullet x-positions: achievements vs experience must left-align. */
async function main() {
  const master = await p.masterTemplate.findFirstOrThrow({ where: { kind: "RESUME", active: true } });
  const tex = insertAchievements(master.texContent, ACHIEVEMENTS);
  const { pdf, pageCount } = await compileLatex(tex);
  console.log(`pages=${pageCount}`);

  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
  const doc = await task.promise;
  const probes = ["Awarded", "Reached", "Built Python", "Engineered a 4-service", "Coursework"];
  const found = new Map<string, number>();
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn);
    const tc = await page.getTextContent();
    for (const probe of probes) {
      if (found.has(probe)) continue;
      const item = tc.items.find((i) => (i as { str: string }).str.startsWith(probe)) as { str: string; transform: number[] } | undefined;
      if (item) found.set(probe, item.transform[4]);
    }
  }
  for (const probe of probes) {
    const x = found.get(probe);
    console.log(x !== undefined ? `x=${x.toFixed(1).padStart(6)}  "${probe}"` : `  --    "${probe}" not found`);
  }
  await task.destroy();
}

main().finally(() => p.$disconnect());
