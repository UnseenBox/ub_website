import { cn } from "@/lib/utils";

/** One star. Filled proportionally so averages like 4.3 read honestly. */
function Star({ fill, className }: { fill: number; className?: string }) {
  const id = `star-${Math.round(fill * 100)}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="currentColor" />
          <stop offset={`${fill * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Read-only rating display. `value` may be fractional (an average);
 * `label` carries the meaning for screen readers.
 */
export function Stars({
  value,
  label,
  className,
  starClassName,
}: {
  value: number;
  label: string;
  className?: string;
  starClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-uv-300", className)} role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Star key={index} fill={Math.min(1, Math.max(0, value - index))} className={starClassName} />
      ))}
    </span>
  );
}
