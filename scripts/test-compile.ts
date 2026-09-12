import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { writeFileSync } from "node:fs";
import { compileLatex } from "../lib/tailor/compile";
import { parseResume, parseCover, assembleResume, assembleCover } from "../lib/tailor/latex";
import { loadMasters } from "./masters";

async function main() {
  const { resumeTex, coverTex, source } = await loadMasters();
  console.log(`masters loaded from ${source}`);

  // 1) round-trip: parse + assemble with NO changes must equal a compilable doc
  const parsed = parseResume(resumeTex);
  console.log(`resume parsed: ${parsed.entries.length} experience entries, bullets=${parsed.entries.map(e => e.bullets.length).join(",")}`);
  // The Experience scan must stop at the next \section. When it did not, it walked
  // into Education's bullet-less \resumeSubheading — throwing on some masters and,
  // on others, absorbing everything after Experience into the last entry so the
  // assembled resume silently lost Skills/Projects/Education.
  for (const section of ["Skills", "Projects", "Education"]) {
    if (resumeTex.includes(`\\section{${section}}`) && !parsed.after.includes(`\\section{${section}}`)) {
      throw new Error(`parseResume swallowed \\section{${section}}: Experience scan overran its section`);
    }
  }
  if (parsed.entries.some((e) => e.bullets.length === 0)) {
    throw new Error("parseResume produced an experience entry with no bullets");
  }

  const roundTrip = assembleResume(parsed, []);
  const r1 = await compileLatex(roundTrip);
  console.log(`resume master round-trip compiles: ${r1.pageCount} page(s)`);
  writeFileSync("test-master-roundtrip.pdf", r1.pdf);

  const pc = parseCover(coverTex);
  console.log(`cover parsed: ${pc.bodyParagraphs.length} paragraphs, addressee=${pc.addressee.company} / ${pc.addressee.city} / ${pc.addressee.role}`);
  const coverRoundTrip = assembleCover(pc, {
    addresseeCompany: pc.addressee.company,
    addresseeCity: pc.addressee.city,
    role: pc.addressee.role,
    bodyParagraphs: pc.bodyParagraphs,
  });
  const r2 = await compileLatex(coverRoundTrip);
  console.log(`cover master round-trip compiles: ${r2.pageCount} page(s)`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
