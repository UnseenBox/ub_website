import { cn } from "@/lib/utils";

/** "[02] — IN THE DARK" style editorial label. */
export function SectionLabel({
  index,
  children,
  className,
}: {
  index?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("label flex items-center gap-3", className)}>
      {index && <span className="font-pixel text-uv-400 normal-case">{index}</span>}
      <span aria-hidden className="h-px w-8 bg-line-strong" />
      <span>{children}</span>
    </p>
  );
}
