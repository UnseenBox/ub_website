import type { PlayMood } from "@/lib/play";
import { cn } from "@/lib/utils";

type IconProps = { className?: string };

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function FullscreenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path
        d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("shrink-0", className)}>
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 9×9 pixel pictograms for the mood cards, in the same hand as the studio's pixel glyphs. */
const MOOD_PATTERNS: Record<PlayMood, string[]> = {
  // A lightning bolt
  quick: ["000001100", "000011000", "000110000", "001111100", "000011000", "000110000", "001100000", "011000000", "000000000"],
  // A sliding puzzle with one tile missing
  brain: ["110110110", "110110110", "000000000", "110110110", "110110110", "000000000", "110110000", "110110000", "000000000"],
  // A burst
  chaos: ["100010001", "010010010", "001111100", "001111100", "111111111", "001111100", "001111100", "010010010", "100010001"],
  // Two players
  friends: ["011000110", "011000110", "000000000", "111101111", "111101111", "111101111", "011000110", "011000110", "000000000"],
  // An eye
  dark: ["000000000", "001111100", "011000110", "110011011", "110011011", "011000110", "001111100", "000000000", "000000000"],
  // A phone
  phone: ["001111100", "001000100", "001000100", "001000100", "001000100", "001000100", "001111100", "001101100", "001111100"],
};

export function MoodIcon({ mood, className }: { mood: PlayMood; className?: string }) {
  return (
    <svg viewBox="0 0 9 9" aria-hidden shapeRendering="crispEdges" className={cn("shrink-0", className)}>
      {MOOD_PATTERNS[mood].flatMap((row, y) =>
        [...row].map((bit, x) =>
          bit === "1" ? <rect key={`${x}-${y}`} x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} fill="currentColor" /> : null,
        ),
      )}
    </svg>
  );
}
