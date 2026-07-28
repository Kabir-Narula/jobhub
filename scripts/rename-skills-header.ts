import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/** One-time: rename the skills header in the active DB master to the ATS-standard "Skills". */
async function main() {
  const master = await p.masterTemplate.findFirstOrThrow({ where: { kind: "RESUME", active: true } });
  const from = "\\section{Technical \\& Analytical Skills}";
  const to = "\\section{Skills}";
  if (!master.texContent.includes(from)) {
    console.log(master.texContent.includes(to) ? "already renamed — nothing to do" : "ERROR: old header not found");
    return;
  }
  await p.masterTemplate.update({
    where: { id: master.id },
    data: { texContent: master.texContent.replace(from, to) },
  });
  console.log("DB master skills header renamed: 'Technical & Analytical Skills' -> 'Skills'");
}

main().finally(() => p.$disconnect());
