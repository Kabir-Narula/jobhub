import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const companyArg = process.argv[2] ?? "TD";
  const job = await p.job.findFirst({
    where: { company: { contains: companyArg }, isActive: true },
    select: { id: true, title: true, company: true },
  });
  if (!job) { console.log(`no job for "${companyArg}"`); return; }
  console.log(`testing: ${job.title} @ ${job.company}`);

  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  const res = await fetch("http://localhost:3000/api/contacts/find", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ jobId: job.id, force: true }),
  });
  const json = await res.json();
  if (!res.ok) { console.log(`FAIL ${res.status}: ${json.error}`); return; }
  console.log(`domain: ${json.domain}`);
  for (const c of json.contacts ?? []) {
    console.log(`  ${c.name} — ${c.role}\n    ${c.email} [${c.deliverability}] why: ${c.why ?? "-"}`);
  }
  await p.$disconnect();
})();
