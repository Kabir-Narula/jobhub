import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const bmo = await p.job.findFirst({ where: { company: { contains: "Montreal" } }, select: { id: true, title: true, company: true } })
    ?? await p.job.findFirst({ where: { source: "workday:bmo" }, select: { id: true, title: true, company: true } });
  if (!bmo) { console.log("no BMO job found"); return; }
  console.log(`testing with: ${bmo.title} @ ${bmo.company}`);

  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  const res = await fetch("http://localhost:3000/api/contacts/find", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ jobId: bmo.id, force: true }),
  });
  const json = await res.json();
  if (!res.ok) { console.log(`FAIL ${res.status}: ${json.error}`); return; }
  console.log(`domain: ${json.domain}`);
  for (const c of json.contacts ?? []) {
    console.log(`  ${c.name} — ${c.role}`);
    console.log(`    ${c.email} [${c.deliverability}] ${c.patternDerived ? "(pattern-derived) " : ""}why: ${c.why ?? "-"}`);
  }
  await p.$disconnect();
})();
