import type { Glyph } from "@/types/content";
import { cn } from "@/lib/utils";

/** 7×7 pixel icons — the studio's own iconography, drawn bit by bit. */
const PATTERNS: Record<Glyph, string[]> = {
  controller: ["0000000", "0111110", "1101011", "1000001", "1101101", "0110110", "0000000"],
  book: ["0110110", "1011101", "1011101", "1011101", "1011101", "0110110", "0001000"],
  visor: ["0000000", "0111110", "1111111", "1101011", "1111111", "0110110", "0000000"],
  lens: ["1100011", "1000001", "0011100", "0010100", "0011100", "1000001", "1100011"],
  installation: ["1111111", "1000001", "1010101", "1000001", "1111111", "0010100", "0100010"],
  cube: ["0011100", "0111110", "1111111", "1011101", "1001001", "0101010", "0011100"],
  target: ["0011100", "0100010", "1001001", "1011101", "1001001", "0100010", "0011100"],
  spark: ["0001000", "0001000", "0011100", "1111111", "0011100", "0001000", "0001000"],
  flask: ["0011100", "0010100", "0010100", "0100010", "1011101", "1111111", "0111110"],
};

export function PixelGlyph({ glyph, className, title }: { glyph: Glyph; className?: string; title?: string }) {
  const rows = PATTERNS[glyph] ?? PATTERNS.cube;
  const cells: { x: number; y: number; i: number }[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((bit, x) => {
      if (bit === "1") cells.push({ x, y, i: cells.length });
    }),
  );
  return (
    <svg
      viewBox="0 0 7 7"
      className={cn("pixel-glyph", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      shapeRendering="crispEdges"
    >
      {cells.map(({ x, y, i }) => (
        <rect
          key={`${x}-${y}`}
          x={x + 0.08}
          y={y + 0.08}
          width={0.84}
          height={0.84}
          fill="currentColor"
          style={{ transitionDelay: `${i * 18}ms` }}
        />
      ))}
    </svg>
  );
}
