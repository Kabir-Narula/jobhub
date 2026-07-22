import { prisma } from "@/lib/db";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [sources, masters, recentRuns] = await Promise.all([
    prisma.companySource.findMany({ orderBy: [{ atsType: "asc" }, { name: "asc" }] }),
    prisma.masterTemplate.findMany({ where: { active: true }, select: { kind: true, uploadedAt: true } }),
    prisma.pollRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
  ]);

  const env = {
    adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
    gtaExtra: process.env.GTA_EXTRA_CITIES || "",
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  return (
    <SettingsClient
      sources={sources}
      masters={masters.map((m) => ({ kind: m.kind, uploadedAt: m.uploadedAt.toISOString() }))}
      recentRuns={recentRuns.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        trigger: r.trigger,
        newJobs: r.newJobs,
        totalSeen: r.totalSeen,
        ok: r.ok,
      }))}
      env={env}
    />
  );
}
