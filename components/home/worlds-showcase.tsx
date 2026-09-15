"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { SmartImage } from "@/components/ui/smart-image";
import { LinkButton } from "@/components/ui/link-button";
import { cn, pad } from "@/lib/utils";

export interface ShowcaseItem {
  slug: string;
  title: string;
  tagline: string;
  genre: string;
  platforms: string;
  status: string;
  year: string;
  cover: string;
  poster: string;
  href: string;
  accent: string;
  hasTrailer: boolean;
}

interface Copy {
  label: string;
  title: string;
  enter: string;
  trailer: string;
  all: string;
  genre: string;
  platforms: string;
  status: string;
  released: string;
  selectorLabel: string;
}

export function WorldsShowcase({ items, copy, allHref }: { items: ShowcaseItem[]; copy: Copy; allHref: string }) {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const select = useCallback((index: number, focus = false) => {
    setActive(index);
    setSeen((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
    if (focus) tabsRef.current[index]?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const rtl = document.documentElement.dir === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forward || event.key === "ArrowDown") {
      event.preventDefault();
      select((active + 1) % items.length, true);
    } else if (event.key === backward || event.key === "ArrowUp") {
      event.preventDefault();
      select((active - 1 + items.length) % items.length, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      select(items.length - 1, true);
    }
  };

  if (items.length === 0) return null;
  const game = items[active];

  return (
    <section id="worlds" aria-labelledby={`${baseId}-heading`} className="relative isolate scroll-mt-16 overflow-hidden border-t border-line">
      {/* Stage */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {items.map((item, i) =>
          seen.has(i) ? (
            <div
              key={item.slug}
              className={cn(
                "absolute inset-0 transition-[opacity,transform] duration-[1400ms] ease-expo",
                i === active ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
              )}
            >
              <SmartImage src={item.cover} alt="" sizes="100vw" quality={60} />
            </div>
          ) : null,
        )}
        <div className="absolute inset-0 bg-void/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-void via-void/80 to-void/10 rtl:bg-gradient-to-l" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/70" />
        <div className="scanlines absolute inset-0 opacity-30" />
      </div>

      <div className="shell flex min-h-[100svh] flex-col py-20 sm:py-28">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="label flex items-center gap-3">
              <span className="font-pixel text-uv-400">01</span>
              <span aria-hidden className="h-px w-8 bg-line-strong" />
              {copy.label}
            </p>
            <h2 id={`${baseId}-heading`} className="font-display mt-4 max-w-md text-2xl text-bone/90 sm:text-3xl">
              {copy.title}
            </h2>
          </div>
          <Link href={allHref} className="label hidden shrink-0 hover:text-bone sm:block">
            {copy.all} →
          </Link>
        </div>

        <div className="mt-auto grid gap-12 pt-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          {/* Active world */}
          <div
            role="tabpanel"
            id={`${baseId}-panel`}
            aria-labelledby={`${baseId}-tab-${active}`}
            aria-live="polite"
            className="max-w-3xl"
          >
            <p className="font-pixel flex items-center gap-3 text-sm text-mist" dir="ltr">
              <span style={{ color: game.accent }}>■</span>
              {pad(active + 1)} / {pad(items.length)}
            </p>
            <div key={game.slug}>
              <h3 className="line-mask mt-4">
                <span className="font-display glitch animate-rise text-giga" data-text={game.title}>
                  {game.title}
                </span>
              </h3>
              <p className="mt-5 max-w-xl animate-fade text-lg text-bone/85 [animation-delay:150ms] sm:text-xl">
                {game.tagline}
              </p>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
              {[
                [copy.genre, game.genre],
                [copy.platforms, game.platforms],
                [copy.status, game.status],
                [copy.released, game.year],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="label">{term}</dt>
                  <dd className="mt-1.5 text-sm text-bone">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href={game.href} cursor={copy.enter}>
                {copy.enter}
              </LinkButton>
              {game.hasTrailer && (
                <LinkButton href={`${game.href}#trailer`} variant="ghost" icon="none">
                  ▶ {copy.trailer}
                </LinkButton>
              )}
            </div>
          </div>

          {/* The deck — posters as physical objects */}
          <div
            role="tablist"
            aria-label={copy.selectorLabel}
            aria-orientation="horizontal"
            className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 pt-8 lg:mx-0 lg:gap-0 lg:overflow-visible lg:p-0 lg:ps-10"
          >
            {items.map((item, i) => {
              const isActive = i === active;
              const tilt = (i - (items.length - 1) / 2) * 3.2;
              return (
                <button
                  key={item.slug}
                  ref={(el) => {
                    tabsRef.current[i] = el;
                  }}
                  id={`${baseId}-tab-${i}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => select(i)}
                  onMouseEnter={() => setSeen((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))}
                  onKeyDown={onKeyDown}
                  data-cursor={isActive ? undefined : item.title}
                  style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
                  className={cn(
                    "group relative w-[38vw] max-w-44 shrink-0 snap-start transition-[transform,filter] duration-700 ease-expo sm:w-40 lg:-ms-10 lg:w-[9.5rem] lg:first:ms-0 xl:w-44",
                    "lg:[transform:rotate(var(--tilt))] lg:hover:[transform:rotate(0deg)_translateY(-1rem)]",
                    isActive
                      ? "z-10 lg:[transform:rotate(0deg)_translateY(-2rem)]"
                      : "brightness-[0.55] hover:z-20 hover:brightness-100",
                  )}
                >
                  <span
                    className={cn(
                      "frame relative block aspect-[2/3] overflow-hidden bg-ink-800 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]",
                      !isActive && "before:opacity-0 after:opacity-0",
                    )}
                  >
                    <SmartImage src={item.poster} alt="" sizes="(min-width: 1024px) 11rem, 40vw" />
                    <span className="absolute inset-0 bg-gradient-to-t from-void/90 via-transparent to-transparent" />
                    <span className="absolute inset-x-3 bottom-3 text-start font-display text-sm leading-tight">
                      {item.title}
                    </span>
                  </span>
                  <span className="sr-only">{item.genre}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
