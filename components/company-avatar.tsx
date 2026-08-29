import { cn } from "@/lib/utils";

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function CompanyAvatar({ company, className }: { company: string; className?: string }) {
  const hue = hashHue(company);
  const letter = (company.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-none border-2 border-foreground text-sm font-semibold text-foreground", className)}
      style={{
        background: `hsl(${hue} 75% 72%)`,
      }}
    >
      {letter}
    </div>
  );
}
