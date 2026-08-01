import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

interface StoredContact {
  name: string;
  role: string;
  email: string;
  confidence: number;
  deliverability: string;
  sources: string[];
  patternDerived?: boolean;
  why?: string;
}

(async () => {
  const rows = await p.job.findMany({
    where: { contacts: { not: { equals: null } } },
    orderBy: { contactsAt: "desc" },
    take: 15,
    select: { title: true, company: true, contacts: true, contactsAt: true },
  });
  console.log(`jobs with contacts: ${rows.length}\n`);
  let indexed = 0, derived = 0, valid = 0, acceptAll = 0, unknown = 0;
  for (const j of rows) {
    const stored = j.contacts as unknown as { domain: string; contacts: StoredContact[] };
    console.log(`${j.company} [${stored.domain}] (${j.contactsAt?.toISOString().slice(0, 10)})`);
    for (const c of stored.contacts ?? []) {
      const tag = c.patternDerived ? "GUESS" : "INDEX";
      if (c.patternDerived) derived++; else indexed++;
      if (c.deliverability === "valid") valid++;
      else if (c.deliverability === "accept_all") acceptAll++;
      else unknown++;
      console.log(`  ${tag} ${c.deliverability.padEnd(10)} conf=${String(c.confidence).padStart(3)} src=${(c.sources ?? []).length}  ${c.email}  (${c.name} — ${c.role})`);
    }
  }
  console.log(`\nindexed=${indexed} pattern-guessed=${derived} | valid=${valid} accept_all=${acceptAll} unknown=${unknown}`);
  await p.$disconnect();
})();
