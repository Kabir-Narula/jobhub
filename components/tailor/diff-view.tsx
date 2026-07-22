"use client";

import { cn } from "@/lib/utils";

/** Renders a unified diff with +/- coloring, tuned for .tex content. */
export function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n").filter((l) => !l.startsWith("---") && !l.startsWith("+++") && !l.startsWith("Index:") && !l.startsWith("==="));
  return (
    <pre className="max-h-[32rem] overflow-auto p-4 font-mono text-xs leading-relaxed">
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre-wrap break-all",
            l.startsWith("+") && "bg-[#dcfce7] text-[#15803d]",
            l.startsWith("-") && "bg-red-600/10 text-red-600",
            l.startsWith("@@") && "text-[#c2410c]",
            !l.startsWith("+") && !l.startsWith("-") && !l.startsWith("@@") && "text-[#8b877a]"
          )}
        >
          {l || " "}
        </div>
      ))}
    </pre>
  );
}
