import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { draftOutreachEmail, draftFollowUpEmail, projectsFromResumeTex } from "../lib/tailor/email";
import type { CompanyResearch } from "../lib/tailor/research";
import type { ContactResult } from "../lib/contacts/hunter";

const p = new PrismaClient();

async function main() {
  const jobIds = process.argv.slice(2).filter((a) => a !== "followup");
  const alsoFollowup = process.argv.includes("followup");
  for (const jobId of jobIds) {
    const job = await p.job.findUnique({ where: { id: jobId } });
    if (!job) {
      console.log(`no job ${jobId}`);
      continue;
    }
    const research = (job.companyResearch as unknown as CompanyResearch | null) ?? null;
    const contact = ((job.contacts as unknown as { contacts?: ContactResult[] } | null)?.contacts ?? [])[0] ?? null;
    const doc =
      (await p.documentVersion.findFirst({
        where: { jobId: job.id, kind: "RESUME", status: "FINAL" },
        orderBy: { version: "desc" },
      })) ??
      (await p.documentVersion.findFirst({
        where: { jobId: job.id, kind: "RESUME" },
        orderBy: { version: "desc" },
      }));
    const base = {
      job: { title: job.title, company: job.company, description: job.description },
      contact,
      research,
      projects: projectsFromResumeTex(doc?.texContent),
      hasFinalDocs: false,
      candidateName: "Kabir Narula",
    };
    const draft = await draftOutreachEmail(base);
    console.log(`\n=== OUTREACH: ${job.title} @ ${job.company} (to: ${contact ? `${contact.name} / ${contact.role}` : "no contact"}) ===`);
    console.log(`Subject: ${draft.subject}\n`);
    console.log(draft.body);
    if (alsoFollowup) {
      const fu = await draftFollowUpEmail({ ...base, daysSinceApplied: 7 });
      console.log(`\n=== FOLLOWUP: ${job.title} @ ${job.company} ===`);
      console.log(`Subject: ${fu.subject}\n`);
      console.log(fu.body);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
