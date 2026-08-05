import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const job = await p.job.findFirst({ where: { company: { contains: "Motorola" }, contacts: { not: { equals: null } } }, select: { id: true, company: true } });
  if (!job) { console.log("no Motorola job with contacts"); return; }
  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  const res = await fetch("http://localhost:3000/api/contacts/bounce", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ jobId: job.id, email: "nazir.zakaria@motorola.com" }),
  });
  const json = await res.json();
  console.log(`bounce route: ${res.status} ${JSON.stringify(json)}`);

  const after = await p.job.findFirst({ where: { id: job.id }, select: { contacts: true } });
  const stored = after?.contacts as unknown as { contacts: { email: string }[] } | null;
  console.log(`remaining contacts: ${stored ? stored.contacts.map((c) => c.email).join(", ") : "(none)"}`);
  await p.$disconnect();
})();
