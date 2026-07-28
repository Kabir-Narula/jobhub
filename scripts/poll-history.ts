import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const runs = await p.pollRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 });
  for (const r of runs.reverse()) {
    const dur = r.finishedAt ? ((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000).toFixed(0) : "?";
    const results = (r.results as { source: string; durationMs: number }[]) ?? [];
    const slowest = [...results].sort((a, b) => b.durationMs - a.durationMs).slice(0, 2);
    console.log(`${r.startedAt.toISOString().slice(5, 16)}  ${String(dur).padStart(4)}s  seen=${r.totalSeen} new=${r.newJobs}  slowest: ${slowest.map((s) => `${s.source} ${(s.durationMs / 1000).toFixed(0)}s`).join(", ")}`);
  }
  await p.$disconnect();
})();
