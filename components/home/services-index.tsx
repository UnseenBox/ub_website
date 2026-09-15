"use client";

import { useId, useState } from "react";
import type { Glyph } from "@/types/content";
import { PixelGlyph } from "@/components/ui/pixel-glyph";
import { LinkButton } from "@/components/ui/link-button";
import { cn, pad } from "@/lib/utils";

export interface ServiceItem {
  id: string;
  title: string;
  kicker: string;
  description: string;
  deliverables: string[];
  glyph: Glyph;
}

/**
 * An editorial index instead of a card grid.
 * Desktop: hover/focus a row, the sticky panel answers.
 * Mobile: rows are an accordion.
 */
export function ServicesIndex({
  items,
  copy,
  startHref,
}: {
  items: ServiceItem[];
  copy: { deliverables: string; start: string };
  startHref: string;
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();
  const current = items[active];

  if (!current) return null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
      <ol className="border-t border-line">
        {items.map((item, i) => {
          const isActive = i === active;
          const isOpen = open === i;
          return (
            <li key={item.id} className="border-b border-line" data-active={isActive}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${baseId}-inline-${i}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => {
                  setActive(i);
                  setOpen(isOpen ? null : i);
                }}
                className="group relative flex w-full items-center gap-4 py-5 text-start sm:gap-6 sm:py-6"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 start-0 w-full origin-left bg-gradient-to-r from-uv-500/12 to-transparent transition-transform duration-700 ease-expo rtl:origin-right rtl:bg-gradient-to-l",
                    isActive ? "scale-x-100" : "scale-x-0",
                  )}
                />
                <span className="font-pixel relative w-7 text-xs text-fog">{pad(i + 1)}</span>
                <span
                  className={cn(
                    "font-display relative flex-1 text-[clamp(1.5rem,3.4vw,3.2rem)] leading-none transition-[color,transform] duration-500 ease-expo",
                    isActive ? "translate-x-2 text-bone rtl:-translate-x-2" : "text-fog",
                  )}
                >
                  {item.title}
                </span>
                <PixelGlyph
                  glyph={item.glyph}
                  className={cn("relative size-7 transition-colors sm:size-9", isActive ? "text-uv-400" : "text-fog/60")}
                />
                <span aria-hidden className="relative font-mono text-lg text-mist lg:hidden">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              <div
                id={`${baseId}-inline-${i}`}
                className={cn(
                  "grid transition-[grid-template-rows] duration-500 ease-expo lg:hidden",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="pb-6 ps-11">
                    <p className="text-bone">{item.kicker}</p>
                    <p className="mt-3 text-sm leading-relaxed text-mist">{item.description}</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {item.deliverables.map((d) => (
                        <li key={d} className="border border-line px-2.5 py-1 font-mono text-[0.68rem] text-mist">
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <aside aria-live="polite" className="hidden lg:block">
        <div className="frame sticky top-28 overflow-hidden border border-line bg-ink-950/70 p-10">
          <div aria-hidden className="uv-glow pointer-events-none absolute -end-1/3 -top-1/3 size-[140%] opacity-60" />
          <div key={current.id} className="relative animate-fade">
            <div className="flex items-start justify-between gap-6">
              <p className="font-pixel text-sm text-uv-400">{pad(active + 1)}</p>
              <PixelGlyph glyph={current.glyph} className="size-20 text-uv-400 [&_rect]:opacity-100" />
            </div>
            <h3 className="font-display mt-8 text-3xl">{current.title}</h3>
            <p className="mt-3 text-lg text-bone/90">{current.kicker}</p>
            <p className="mt-5 leading-relaxed text-mist">{current.description}</p>
            <p className="label mt-8">{copy.deliverables}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {current.deliverables.map((d) => (
                <li key={d} className="border border-line-strong px-3 py-1.5 font-mono text-xs text-bone/90">
                  {d}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <LinkButton href={startHref} variant="ghost">
                {copy.start}
              </LinkButton>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
