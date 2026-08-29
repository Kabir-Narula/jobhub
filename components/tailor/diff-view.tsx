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
      className="max-h-[32rem] overflow-auto bg-card p-4 font-mono text-xs leading-relaxed"
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre-wrap break-all",
            l.startsWith("+") && "border-2 border-foreground bg-primary/40 px-1 text-foreground",
            l.startsWith("-") && "border-2 border-foreground bg-destructive/20 px-1 text-foreground",
            l.startsWith("@@") && "mt-1 bg-muted px-1 font-bold text-foreground",
            !l.startsWith("+") && !l.startsWith("-") && !l.startsWith("@@") && "text-muted-foreground"
          )}
        >
          {l || " "}
        </div>
      ))}
    </motion.pre>
  );
}
