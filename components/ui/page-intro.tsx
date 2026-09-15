import type { ReactNode } from "react";
import { SectionLabel } from "./section-label";

/** Shared opening for inner pages: label, oversized title, lede, optional aside. */
export function PageIntro({
  index,
  label,
  title,
  lede,
  aside,
}: {
  index: string;
  label: string;
  title: string;
  lede?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden className="uv-glow pointer-events-none absolute -end-1/4 -top-1/2 -z-10 size-[90vw] opacity-70" />
      <div className="shell grid gap-10 pb-16 pt-32 sm:pb-24 sm:pt-44 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="animate-fade">
            <SectionLabel index={index}>{label}</SectionLabel>
          </div>
          <h1 className="font-display mt-8 max-w-6xl text-giga text-balance">
            <span className="line-mask">
              <span className="animate-rise [animation-delay:80ms]">{title}</span>
            </span>
          </h1>
          {lede && (
            <p className="mt-8 max-w-2xl animate-fade text-lg leading-relaxed text-mist [animation-delay:300ms] sm:text-xl">
              {lede}
            </p>
          )}
        </div>
        {aside && <div className="animate-fade [animation-delay:450ms]">{aside}</div>}
      </div>
    </header>
  );
}
