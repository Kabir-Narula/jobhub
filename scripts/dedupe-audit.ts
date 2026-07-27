import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";
import { companiesMatch } from "../lib/dedupe";

const p = new PrismaClient();
const DRY = process.argv.includes("--dry");

type Row = {
  id: string;
  title: string;
  company: string;
  source: string;
  sourceId: string;
  city: string;
  normTitle: string;
  description: string;
  firstSeenAt: Date;
  savedAt: Date | null;
  dismissedAt: Date | null;
  viewedAt: Date | null;
  applyPromptDismissedAt: Date | null;
  isActive: boolean;
  appCount: number;
};

let mergedGroups = 0;
let deactivated = 0;
let appsMoved = 0;
let docsMoved = 0;
let appsCollapsed = 0;

/** Merge one duplicate component into a single winner row. */
async function mergeComponent(comp: Row[], label: string): Promise<void> {
  if (comp.length < 2) return;
  // nothing visible to fix if every row is already inactive
  if (!comp.some((r) => r.isActive)) return;
  comp.sort((a, b) =>
    Number(b.isActive) - Number(a.isActive) ||
    b.description.length - a.description.length ||
    a.firstSeenAt.getTime() - b.firstSeenAt.getTime()
  );
  const winner = comp[0];
  const losers = comp.slice(1);
  mergedGroups++;
  console.log(`\nDUP GROUP [${label}] (${comp.length}) "${winner.title}" @ ${winner.city}:`);
  console.log(`  WINNER  ${winner.company} [${winner.source}${winner.sourceId ? `:${winner.sourceId}` : ""}] active=${winner.isActive} apps=${winner.appCount} desc=${winner.description.length}c`);
  for (const l of losers) {
    console.log(`  merge<- ${l.company} [${l.source}${l.sourceId ? `:${l.sourceId}` : ""}] active=${l.isActive} apps=${l.appCount} desc=${l.description.length}c "${l.title}"`);
  }
  if (DRY) return;

  for (const loser of losers) {
    // move applications to winner
    const movedApps = await p.application.updateMany({
      where: { jobId: loser.id },
      data: { jobId: winner.id },
    });
    appsMoved += movedApps.count;

    // move documents, bumping version on (kind, version) conflict with winner's docs
    const loserDocs = await p.documentVersion.findMany({
      where: { jobId: loser.id },
      select: { id: true, kind: true, version: true },
    });
    for (const d of loserDocs) {
      const conflict = await p.documentVersion.findUnique({
        where: { jobId_kind_version: { jobId: winner.id, kind: d.kind, version: d.version } },
        select: { id: true },
      });
      let version = d.version;
      if (conflict) {
        const max = await p.documentVersion.aggregate({
          where: { jobId: winner.id, kind: d.kind },
          _max: { version: true },
        });
        version = (max._max.version ?? 0) + 1;
      }
      await p.documentVersion.update({ where: { id: d.id }, data: { jobId: winner.id, version } });
      docsMoved++;
    }

    // carry over interaction state the winner lacks
    await p.job.update({
      where: { id: winner.id },
      data: {
        savedAt: winner.savedAt ?? loser.savedAt,
        dismissedAt: winner.dismissedAt ?? loser.dismissedAt,
        viewedAt: winner.viewedAt ?? loser.viewedAt,
        applyPromptDismissedAt: winner.applyPromptDismissedAt ?? loser.applyPromptDismissedAt,
      },
    });
    // reflect carried state for subsequent losers in the same group
    winner.savedAt = winner.savedAt ?? loser.savedAt;
    winner.dismissedAt = winner.dismissedAt ?? loser.dismissedAt;
    winner.viewedAt = winner.viewedAt ?? loser.viewedAt;
    winner.applyPromptDismissedAt = winner.applyPromptDismissedAt ?? loser.applyPromptDismissedAt;

    await p.job.update({ where: { id: loser.id }, data: { isActive: false } });
    deactivated++;
  }

  // several losers may have carried their own Application rows onto the winner
  // (user clicked "applied" on two copies of the same job) -> collapse to one.
  const apps = await p.application.findMany({
    where: { jobId: winner.id },
    orderBy: { appliedAt: "asc" },
    include: { _count: { select: { documents: true } } },
  });
  if (apps.length > 1) {
    const rank = { OFFER: 4, INTERVIEWING: 3, APPLIED: 2, REJECTED: 1, GHOSTED: 1 } as Record<string, number>;
    const sorted = [...apps].sort((a, b) =>
      b._count.documents - a._count.documents || a.appliedAt.getTime() - b.appliedAt.getTime()
    );
    const keep = sorted[0];
    for (const dup of sorted.slice(1)) {
      await p.documentVersion.updateMany({ where: { applicationId: dup.id }, data: { applicationId: keep.id } });
      const extraNote = dup.notes && !keep.notes.includes(dup.notes) ? dup.notes : "";
      const merged = {
        notes: extraNote ? [keep.notes, extraNote].filter(Boolean).join("\n---\n") : keep.notes,
        status: (rank[dup.status] ?? 0) > (rank[keep.status] ?? 0) ? dup.status : keep.status,
        responseAt: keep.responseAt ?? dup.responseAt,
        researchNotes: keep.researchNotes || dup.researchNotes,
        resumeVersionId: keep.resumeVersionId ?? dup.resumeVersionId,
        coverVersionId: keep.coverVersionId ?? dup.coverVersionId,
      };
      // delete first to free the @unique resume/cover version refs, then update
      await p.application.delete({ where: { id: dup.id } });
      await p.application.update({ where: { id: keep.id }, data: merged });
      Object.assign(keep, merged);
      appsCollapsed++;
      console.log(`  collapsed duplicate application ${dup.id} -> ${keep.id}`);
    }
  }
}

/**
 * Two-phase duplicate sweep:
 *   phase 1 — same city + normalized title with fuzzy company match
 *   phase 2 — same (source, sourceId): one posting retitled/relisted
 * Pool = active jobs PLUS inactive jobs holding applications/documents
 * (catches: applied job went stale, dupe still live and showing as "new").
 * Winner = active, then longest description, then earliest firstSeenAt.
 * Applications/documents are re-pointed at the winner; losers go isActive=false.
 */
async function main() {
  const jobs = await p.job.findMany({
    where: {
      OR: [
        { isActive: true },
        { applications: { some: {} } },
        { documents: { some: {} } },
      ],
    },
    select: {
      id: true, title: true, company: true, source: true, sourceId: true, city: true, normTitle: true,
      description: true, firstSeenAt: true, savedAt: true, dismissedAt: true,
      viewedAt: true, applyPromptDismissedAt: true, isActive: true,
      _count: { select: { applications: true } },
    },
  });
  const rows: Row[] = jobs.map((j) => ({ ...j, appCount: j._count.applications }));

  // ---- phase 1: city + normTitle groups, union-find by companiesMatch ----
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.normTitle) continue;
    const key = `${r.city.toLowerCase()}|${r.normTitle}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const components: Row[][] = [];
    for (const r of arr) {
      const hits = components.filter((comp) => comp.some((c) => companiesMatch(c.company, r.company)));
      if (hits.length === 0) {
        components.push([r]);
      } else {
        const merged = hits.flat().concat(r);
        for (const h of hits) components.splice(components.indexOf(h), 1);
        components.push(merged);
      }
    }
    for (const comp of components) await mergeComponent(comp, "fuzzy");
  }

  // ---- phase 2: same (source, sourceId) ----
  const bySid = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.sourceId) continue;
    const key = `${r.source}|${r.sourceId}`;
    const arr = bySid.get(key) ?? [];
    arr.push(r);
    bySid.set(key, arr);
  }
  for (const [key, arr] of bySid) {
    if (arr.length < 2) continue;
    await mergeComponent(arr, `same-id ${key}`);
  }

  console.log(`\n${DRY ? "[DRY RUN] " : ""}done: ${mergedGroups} dup groups, ${deactivated} jobs deactivated, ${appsMoved} applications moved, ${docsMoved} documents moved, ${appsCollapsed} duplicate applications collapsed`);
}

main().finally(() => p.$disconnect());
