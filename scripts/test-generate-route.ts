import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Drives the real /api/tailor/generate route end-to-end against the dev server.
 * Usage: npx tsx scripts/test-generate-route.ts <jobId> [jobId...]
 */
async function main() {
  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  const jobIds = process.argv.slice(2);
  if (!jobIds.length) {
    console.error("usage: npx tsx scripts/test-generate-route.ts <jobId> [jobId...]");
    process.exit(1);
  }

  for (const jobId of jobIds) {
    const t0 = Date.now();
    const res = await fetch("http://localhost:3000/api/tailor/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ jobId, force: true }),
    });
    const json = await res.json();
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (!res.ok) {
      console.log(`\nFAIL ${jobId}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
      continue;
    }
    console.log(`\nOK ${jobId} (${secs}s)`);
    console.log(`  resume: v${json.resume.version} pages=${json.resume.pageCount} ats=${json.resume.matchScore} fill=${json.resume.fillPct}%`);
    console.log(`  cover:  v${json.cover.version} pages=${json.cover.pageCount}`);
    console.log(`  projects: ${(json.chosenProjects ?? []).join(", ")}`);
    console.log(`  droppedEntries: ${(json.droppedEntries ?? []).join("; ") || "(none)"}`);
    console.log(`  missingKeywords: ${(json.resume.missingKeywords ?? []).slice(0, 8).join(", ")}`);
    if (json.warnings?.length) console.log(`  WARNINGS: ${json.warnings.join(" | ")}`);
    if (json.appliedTitleChanges?.length) {
      for (const t of json.appliedTitleChanges) console.log(`  title: "${t.from}" -> "${t.to}" (${t.company})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
