import { cn } from "@/lib/utils";

type IconProps = { className?: string };

const base = "shrink-0";

/** Direction-aware arrow: points "forward" in both LTR and RTL. */
export function ArrowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn(base, "rtl:-scale-x-100", className)}>
      <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function ArrowDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn(base, className)}>
      <path d="M12 4v15M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function ExternalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn(base, "rtl:-scale-x-100", className)}>
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn(base, className)}>
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn(base, className)}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn(base, className)}>
      <rect x="8" y="8" width="11" height="11" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 15V5h10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** The UnseenBox mark: a box whose lid has just come open, with a light inside. */
export function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn(base, className)} shapeRendering="crispEdges">
      <path d="M3 3h18v3H6v20h20V11h3v18H3V3Z" fill="currentColor" />
      <rect x="24" y="3" width="5" height="5" fill="currentColor" opacity=".35" />
      <rect x="11" y="16" width="5" height="5" fill="#8f5bff" />
    </svg>
  );
}

/* Social marks. Simplified glyphs, not the brands' official logo files. */

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className={cn(base, className)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className={cn(base, className)}>
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path d="M10.4 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Stands in for itch.io: a controller, not the brand's logo. */
export function ControllerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className={cn(base, className)}>
      <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l.8 4a3.4 3.4 0 0 1-6.2 2.5L14.8 16H9.2l-.7 1.1a3.4 3.4 0 0 1-6.2-2.5l.8-4A4.5 4.5 0 0 1 7.5 7Z" />
      <path d="M7.4 10.8v2.4M6.2 12h2.4" strokeLinecap="round" />
      <circle cx="16" cy="11.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="13.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
