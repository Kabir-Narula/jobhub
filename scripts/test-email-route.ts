import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Drives /api/email/draft end-to-end against the dev server.
 * Usage: npx tsx scripts/test-email-route.ts <jobId> [followup]
 */
async function main() {
  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  const jobId = process.argv[2];
  const mode = process.argv[3] === "followup" ? "followup" : "outreach";
  if (!jobId) {
    console.error("usage: npx tsx scripts/test-email-route.ts <jobId> [followup]");
    process.exit(1);
  }

  const res = await fetch("http://localhost:3000/api/email/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ jobId, mode }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.log(`FAIL: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    return;
  }
  const draft = json.draft ?? {};
  console.log(`OK ${mode} email:`);
  console.log(`  to: ${json.contact?.email ?? "(no contact — draft only)"}`);
  console.log(`  subject: ${draft.subject ?? "(none)"}`);
  const body = draft.body ?? "";
  console.log(`  body (${body.split(/\s+/).filter(Boolean).length} words):\n${body.split("\n").map((l: string) => `    ${l}`).join("\n")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
