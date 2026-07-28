import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const p = new PrismaClient();

(async () => {
  const d = await p.documentVersion.findFirst({
    where: { kind: "RESUME" },
    orderBy: { createdAt: "desc" },
    select: { texContent: true, pageCount: true, matchScore: true, job: { select: { title: true, company: true } } },
  });
  if (!d) { console.log("no doc"); return; }
  const tex = d.texContent;
  console.log(`${d.job.title} @ ${d.job.company}  pages=${d.pageCount} ats=${d.matchScore}`);

  // 1) headline line under the header
  const headM = tex.match(/\\end\{center\}/);
  const headerBlock = tex.slice(tex.indexOf("\\begin{center}"), headM ? headM.index : 600);
  const headlineLine = headerBlock.split("\n").find((l) => l.includes("\\textit"));
  console.log(`\n1) headline: ${headlineLine ? `PASS -> ${headlineLine.trim().slice(0, 110)}` : "FAIL (missing)"}`);

  // 2) ATS-standard skills header
  console.log(`2) skills header: ${tex.includes("\\section{Skills}") ? "PASS (\\section{Skills})" : tex.includes("\\section{Technical") ? "FAIL (old header)" : "FAIL (none found)"}`);

  // 3) PDF metadata in tex
  const meta = tex.match(/\\hypersetup\{pdftitle=\{([^}]*)\},pdfauthor=\{([^}]*)\}\}/);
  console.log(`3) metadata: ${meta ? `PASS -> title="${meta[1]}" author="${meta[2]}"` : "FAIL (no hypersetup)"}`);

  // 4) placement backfill: skills block non-empty + contains JD terms used in bullets
  const skillsM = tex.match(/\\section\{Skills\}([\s\S]*?)\\end\{itemize\}/);
  console.log(`4) skills block: ${skillsM ? "present" : "MISSING"}`);
  if (skillsM) {
    const lines = [...skillsM[1].matchAll(/\\textbf\{([^{}]*)\}\{:\s*([^{}]*)\}/g)].map((m) => `${m[1].replace(/\\&/g, "&")}: ${m[2].replace(/ \\\\$/, "")}`);
    for (const l of lines) console.log(`   ${l}`);
  }

  // 5) PDF-level: metadata + headline visible in text layer
  const { compileLatex } = await import("../lib/tailor/compile");
  const { pdf } = await compileLatex(tex);
  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
  const doc = await task.promise;
  const info = await doc.getMetadata().catch(() => null);
  console.log(`5) pdf info: ${info ? JSON.stringify((info as { info?: unknown }).info).slice(0, 160) : "(none)"}`);
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const text = tc.items.map((i) => (i as { str: string }).str).join(" ");
  const titleProbe = d.job.title.split(" ").slice(0, 3).join(" ");
  console.log(`   headline in text layer: ${text.includes(titleProbe) ? `PASS ("${titleProbe}" found near top: idx ${text.indexOf(titleProbe)})` : "FAIL"}`);
  await task.destroy();
  await p.$disconnect();
})();
