"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ExperienceType } from "@/types/content";
import { SmartImage } from "@/components/ui/smart-image";
import { cn } from "@/lib/utils";
import type { ArchiveItem } from "./archive-strip";

const PAGE = 6;

/** Asymmetric 12-column rhythm; repeats every six entries. */
const RHYTHM = [
  "lg:col-span-7 aspect-[4/3]",
  "lg:col-span-5 aspect-[4/5] lg:mt-24",
  "lg:col-span-4 aspect-[3/4]",
  "lg:col-span-8 aspect-[16/10] lg:mt-16",
  "lg:col-span-6 aspect-[4/3]",
  "lg:col-span-6 aspect-[4/3] lg:mt-24",
];

export function ArchiveGrid({
  items,
  types,
  copy,
}: {
  items: ArchiveItem[];
  types: { value: ExperienceType; label: string }[];
  copy: { filterAll: string; loadMore: string; empty: string; filterLabel: string };
}) {
  const [filter, setFilter] = useState<ExperienceType | "all">("all");
  const [visible, setVisible] = useState(PAGE);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.type === filter)),
    [items, filter],
  );
  const available = types.filter((type) => items.some((item) => item.type === type.value));

  return (
    <div>
      <div role="group" aria-label={copy.filterLabel} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {[{ value: "all" as const, label: copy.filterAll }, ...available].map((type) => {
          const active = filter === type.value;
          const count = type.value === "all" ? items.length : items.filter((i) => i.type === type.value).length;
          return (
            <button
              key={type.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(type.value);
                setVisible(PAGE);
              }}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 border px-4 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors",
                active ? "border-uv-400 bg-uv-500/15 text-bone" : "border-line text-mist hover:border-line-strong hover:text-bone",
              )}
            >
              {type.label}
              <span className="font-pixel text-[0.6rem] text-fog" dir="ltr">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {filtered.length}
      </p>

      {filtered.length === 0 ? (
        <p className="py-24 text-mist">{copy.empty}</p>
      ) : (
        <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-y-20">
          {filtered.slice(0, visible).map((item, i) => (
            <li key={item.slug} className={cn(RHYTHM[i % RHYTHM.length].split(" ").filter((c) => c.startsWith("lg:")).join(" "))}>
              <Link href={item.href} className="group block">
                <div
                  className={cn(
                    "frame relative overflow-hidden bg-ink-800",
                    RHYTHM[i % RHYTHM.length].split(" ").filter((c) => c.startsWith("aspect")).join(" "),
                  )}
                >
                  <SmartImage
                    src={item.cover}
                    alt=""
                    sizes="(min-width: 1024px) 50vw, (min-width: 640px) 50vw, 100vw"
                    className="transition-transform duration-[1400ms] ease-expo group-hover:scale-[1.04]"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-void/60 via-transparent to-transparent" />
                  <span className="font-pixel absolute start-3 top-3 bg-void/70 px-2 py-1 text-[0.65rem]" dir="ltr">
                    {item.stamp}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
                  <h2 className="font-display text-2xl leading-tight transition-colors group-hover:text-uv-300 sm:text-3xl">
                    {item.title}
                  </h2>
                  <span className="label pt-2">{item.typeLabel}</span>
                  <p className="col-span-2 max-w-xl text-sm leading-relaxed text-mist">{item.summary}</p>
                  <p className="label col-span-2 text-fog">{item.location}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {visible < filtered.length && (
        <div className="mt-20 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="h-12 border border-line-strong px-8 font-mono text-[0.72rem] uppercase tracking-[0.16em] transition-colors hover:border-uv-400 hover:bg-uv-500/10"
          >
            {copy.loadMore} <span className="font-pixel ms-2 text-fog" dir="ltr">+{Math.min(PAGE, filtered.length - visible)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
