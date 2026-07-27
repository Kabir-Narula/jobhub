import { prisma } from "@/lib/db";
import { companiesMatch } from "@/lib/dedupe";

export interface SweepStats {
  mergedGroups: number;
  deactivated: number;
  appsMoved: number;
  docsMoved: number;
  appsCollapsed: number;
}

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
  mergedAt: Date | null;
  appCount: number;
};

/**
 * Two-phase duplicate sweep:
 *   phase 1 — same city + normalized title with fuzzy company match
 *   phase 2 — same (source, sourceId): one posting retitled/relisted
 * Pool = non-merged jobs that are active OR hold applications/documents
 * (catches: applied job went stale, dupe still live and showing as "new").
 * Groups with no active row are skipped (nothing visible to fix).
 * Winner = active, then longest description, then earliest firstSeenAt.
 * Applications/documents/interaction state move to the winner; losers get
 * isActive=false + mergedAt/mergedIntoId so polls never resurrect them
 * (a touch on a loser forwards to the winner instead).
 */
export async function sweepDuplicates(opts: {
  dry?: boolean;
  log?: (msg: string) => void;
} = {}): Promise<SweepStats> {
  const log = opts.log ?? (() => {});
  const stats: SweepStats = { mergedGroups: 0, deactivated: 0, appsMoved: 0, docsMoved: 0, appsCollapsed: 0 };

  const jobs = await prisma.job.findMany({
    where: {
      mergedAt: null,
      OR: [{ isActive: true }, { applications: { some: {} } }, { documents: { some: {} } }],
    },
    select: {
      id: true, title: true, company: true, source: true, sourceId: true, city: true, normTitle: true,
      description: true, firstSeenAt: true, savedAt: true, dismissedAt: true,
      viewedAt: true, applyPromptDismissedAt: true, isActive: true, mergedAt: true,
      _count: { select: { applications: true } },
    },
  });
  const rows: Row[] = jobs.map((j) => ({ ...j, appCount: j._count.applications }));

  async function mergeComponent(comp: Row[], label: string): Promise<void> {
    if (comp.length < 2) return;
    if (!comp.some((r) => r.isActive)) return;
    comp.sort((a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      b.description.length - a.description.length ||
      a.firstSeenAt.getTime() - b.firstSeenAt.getTime()
    );
    const winner = comp[0];
    const losers = comp.slice(1);
    stats.mergedGroups++;
    log(`DUP [${label}] "${winner.title}" @ ${winner.city}: keep ${winner.company} [${winner.source}], merge ${losers.length} dupe(s)`);
    if (opts.dry) return;

    for (const loser of losers) {
      const movedApps = await prisma.application.updateMany({
        where: { jobId: loser.id },
        data: { jobId: winner.id },
      });
      stats.appsMoved += movedApps.count;

      // move documents, bumping version on (kind, version) conflict with winner's docs
      const loserDocs = await prisma.documentVersion.findMany({
        where: { jobId: loser.id },
        select: { id: true, kind: true, version: true },
      });
      for (const d of loserDocs) {
        const conflict = await prisma.documentVersion.findUnique({
          where: { jobId_kind_version: { jobId: winner.id, kind: d.kind, version: d.version } },
          select: { id: true },
        });
        let version = d.version;
        if (conflict) {
          const max = await prisma.documentVersion.aggregate({
            where: { jobId: winner.id, kind: d.kind },
            _max: { version: true },
          });
          version = (max._max.version ?? 0) + 1;
        }
        await prisma.documentVersion.update({ where: { id: d.id }, data: { jobId: winner.id, version } });
        stats.docsMoved++;
      }

      // carry over interaction state the winner lacks
      await prisma.job.update({
        where: { id: winner.id },
        data: {
          savedAt: winner.savedAt ?? loser.savedAt,
          dismissedAt: winner.dismissedAt ?? loser.dismissedAt,
          viewedAt: winner.viewedAt ?? loser.viewedAt,
          applyPromptDismissedAt: winner.applyPromptDismissedAt ?? loser.applyPromptDismissedAt,
        },
      });
      winner.savedAt = winner.savedAt ?? loser.savedAt;
      winner.dismissedAt = winner.dismissedAt ?? loser.dismissedAt;
      winner.viewedAt = winner.viewedAt ?? loser.viewedAt;
      winner.applyPromptDismissedAt = winner.applyPromptDismissedAt ?? loser.applyPromptDismissedAt;

      await prisma.job.update({
        where: { id: loser.id },
        data: { isActive: false, mergedAt: new Date(), mergedIntoId: winner.id },
      });
      stats.deactivated++;
    }

    // several losers may have carried their own Application rows onto the winner
    // (user clicked "applied" on two copies of the same job) -> collapse to one.
    const apps = await prisma.application.findMany({
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
        await prisma.documentVersion.updateMany({ where: { applicationId: dup.id }, data: { applicationId: keep.id } });
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
        await prisma.application.delete({ where: { id: dup.id } });
        await prisma.application.update({ where: { id: keep.id }, data: merged });
        Object.assign(keep, merged);
        stats.appsCollapsed++;
        log(`  collapsed duplicate application ${dup.id} -> ${keep.id}`);
      }
    }
  }

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

  return stats;
}
