import { prisma } from "@/lib/db";
import { format, differenceInDays } from "date-fns";

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Download all tracked applications as CSV. */
export async function GET() {
  const apps = await prisma.application.findMany({
    include: { job: true },
    orderBy: { appliedAt: "desc" },
  });

  const header = "Company,Role,Bucket,Source,Applied,Status,Days Since Applied,Notes\n";
  const rows = apps
    .map((a) =>
      [
        csvCell(a.job.company),
        csvCell(a.job.title),
        a.job.bucket,
        a.job.source,
        format(a.appliedAt, "yyyy-MM-dd"),
        a.status,
        String(differenceInDays(new Date(), a.appliedAt)),
        csvCell(a.notes ?? ""),
      ].join(",")
    )
    .join("\n");

  return new Response(header + rows + "\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="jobhub-applications-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}
