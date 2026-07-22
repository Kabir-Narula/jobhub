import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compileLatex } from "../lib/tailor/compile";
import { parseResume, parseCover, assembleResume, assembleCover, normalizeForTectonic } from "../lib/tailor/latex";

async function main() {
  const resumeTex = normalizeForTectonic(readFileSync(path.join(process.cwd(), "..", "Resume.tex"), "utf8"));
  const coverTex = normalizeForTectonic(readFileSync(path.join(process.cwd(), "..", "cover.tex"), "utf8"));

  // 1) round-trip: parse + assemble with NO changes must equal a compilable doc
  const parsed = parseResume(resumeTex);
  console.log(`resume parsed: ${parsed.entries.length} experience entries, bullets=${parsed.entries.map(e => e.bullets.length).join(",")}`);
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
