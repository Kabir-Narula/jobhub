"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Renders a unified diff with +/- coloring, tuned for .tex content. */
export function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n").filter((l) => !l.startsWith("---") && !l.startsWith("+++") && !l.startsWith("Index:") && !l.startsWith("==="));
  return (
    <motion.pre
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="max-h-[32rem] overflow-auto p-4 font-mono text-xs leading-relaxed"
    >
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
    </motion.pre>
  );
}
