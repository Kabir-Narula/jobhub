import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const p = new PrismaClient();

/**
 * ATS text-layer audit: what does an ATS parser actually SEE in our PDF?
 * - ligature glyphs (fi/fl/ffi as U+FB00-FB04 single chars) break keyword matching
 * - hyphenated line-break splits ("optimi- zation") break keyword matching
 * - non-ASCII bullets/dashes
 */
async function main() {
  const d = await p.documentVersion.findFirst({
    where: { kind: "RESUME", pdfStoragePath: { not: "" } },
    orderBy: { createdAt: "desc" },
    select: { texContent: true, job: { select: { title: true, company: true } } },
  });
  if (!d) { console.log("no doc"); return; }
  console.log(`latest: ${d.job.title} @ ${d.job.company}`);

  // compile fresh from stored tex (same bytes as stored PDF)
  const { compileLatex } = await import("../lib/tailor/compile");
  const { pdf } = await compileLatex(d.texContent);

  const task = getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const text = tc.items.map((i) => (i as { str: string }).str).join(" ");

  // 1) ligature codepoints
  const ligatures = text.match(/[ﬀﬁﬂﬃﬄﬅﬆ]/g);
  console.log(`\n1) ligature glyphs (U+FB00+): ${ligatures ? `${ligatures.length} -> ${[...new Set(ligatures)].join(" ")}` : "NONE (clean)"}`);

  // 2) hyphenated line splits: "word- word" pattern in extracted text
  const splits = text.match(/[a-z]{3,}-\s[a-z]{3,}/g);
  console.log(`2) possible hyphen splits: ${splits ? splits.slice(0, 10).join(" | ") : "NONE"}`);

  // 3) non-ASCII inventory
  const nonAscii = [...new Set((text.match(/[^\x00-\x7F]/g) ?? []))];
  console.log(`3) non-ASCII chars: ${nonAscii.length ? nonAscii.map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}(${c})`).join(" ") : "NONE"}`);

  // 4) keyword extraction sanity: can a matcher find these exact terms?
  const probes = ["FastAPI", "PostgreSQL", "CI/CD", "TypeScript", "Java", "Node.js", "C++", "Kubernetes", "machine learning", "fine tuning"];
  for (const probe of probes) {
    const idx = text.toLowerCase().indexOf(probe.toLowerCase());
    console.log(`   ${idx >= 0 ? "FOUND" : "miss "} "${probe}"${idx >= 0 ? ` @${idx}` : ""}`);
  }

  // 5) extraction order: first 400 chars (ATS reads linearly)
  console.log(`\n5) first 400 chars of text layer:\n${text.slice(0, 400)}`);
  await task.destroy();
}

main().finally(() => p.$disconnect());
