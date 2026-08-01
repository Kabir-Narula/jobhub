import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/**
 * One-time invalidation of bad contact caches:
 *  - empty results cached by the pre-oracle code (permanent failure bug)
 *  - known wrong domains (jm.com = Jardine Matheson for "J&M Group",
 *    xecom.io for Xe.com, tdbank.com for TD Bank)
 * Cleared rows re-resolve fresh on the next Find Contacts click.
 */
async function main() {
  const rows = await p.job.findMany({
    where: { contacts: { not: { equals: null } } },
    select: { id: true, company: true, contacts: true },
  });
  const BAD_DOMAINS = new Set(["jm.com", "xecom.io", "tdbank.com"]);
  let cleared = 0;
  for (const j of rows) {
    const stored = j.contacts as unknown as { domain: string; contacts: unknown[] };
    if (!stored || !Array.isArray(stored.contacts)) continue;
    if (stored.contacts.length === 0 || BAD_DOMAINS.has(stored.domain)) {
      await p.job.update({ where: { id: j.id }, data: { contacts: null as never, contactsAt: null } });
      console.log(`cleared ${j.company} [${stored.domain}] (${stored.contacts.length} contacts)`);
      cleared++;
    }
  }
  console.log(`\n${cleared} bad contact caches invalidated`);
}

main().finally(() => p.$disconnect());
