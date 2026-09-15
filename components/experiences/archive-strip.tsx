"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ExperienceType } from "@/types/content";
import { SmartImage } from "@/components/ui/smart-image";
import { ArrowIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface ArchiveItem {
  slug: string;
  title: string;
  type: ExperienceType;
  typeLabel: string;
  stamp: string;
  dateLabel: string;
  location: string;
  summary: string;
  cover: string;
  href: string;
}

/** A film strip of frames with varying proportions. Native scroll + drag. */
export function ArchiveStrip({
  items,
  copy,
}: {
  items: ArchiveItem[];
  copy: { previous: string; next: string; drag: string };
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const drag = useRef({ active: false, startX: 0, scroll: 0, moved: false });
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const pos = Math.abs(track.scrollLeft); // negative in RTL
      setEdges({ start: pos < 8, end: pos > max - 8 });
    };
    update();
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      track.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const rtl = getComputedStyle(track).direction === "rtl";
    track.scrollBy({ left: direction * track.clientWidth * 0.8 * (rtl ? -1 : 1), behavior: "smooth" });
  };

  const onPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== "mouse") return;
    const track = trackRef.current!;
    drag.current = { active: true, startX: event.clientX, scroll: track.scrollLeft, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    if (!drag.current.active) return;
    const dx = event.clientX - drag.current.startX;
    if (Math.abs(dx) > 5) {
      drag.current.moved = true;
      trackRef.current!.style.scrollSnapType = "none";
    }
    trackRef.current!.scrollLeft = drag.current.scroll - dx;
  };
  const endDrag = () => {
    drag.current.active = false;
    if (trackRef.current) trackRef.current.style.scrollSnapType = "";
  };

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(event) => {
          if (drag.current.moved) {
            event.preventDefault();
            event.stopPropagation();
            drag.current.moved = false;
          }
        }}
        data-cursor={copy.drag}
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto px-[clamp(1rem,4vw,3.5rem)] pb-6 sm:gap-6"
      >
        {items.map((item, i) => {
          const tall = i % 3 === 1;
          return (
            <li
              key={item.slug}
              className={cn(
                "shrink-0 snap-start",
                tall ? "w-[68vw] sm:w-[22rem]" : "w-[82vw] sm:w-[30rem]",
                i % 2 === 1 && "sm:pt-16",
              )}
            >
              <Link href={item.href} className="group block" draggable={false}>
                <div className={cn("frame relative overflow-hidden bg-ink-800", tall ? "aspect-[3/4]" : "aspect-[4/3]")}>
                  <SmartImage
                    src={item.cover}
                    alt=""
                    sizes="(min-width: 640px) 30rem, 82vw"
                    className="transition-transform duration-[1200ms] ease-expo group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-void/70 to-transparent opacity-80" />
                  <span className="font-pixel absolute start-3 top-3 bg-void/70 px-2 py-1 text-[0.65rem] text-bone" dir="ltr">
                    {item.stamp}
                  </span>
                  <span className="label absolute bottom-3 end-3 text-bone">{item.typeLabel}</span>
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl leading-tight transition-colors group-hover:text-uv-300 sm:text-2xl">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-fog">{item.location}</p>
                  </div>
                  <ArrowIcon className="mt-1 size-5 text-fog transition-[transform,color] duration-500 ease-expo group-hover:translate-x-1 group-hover:text-uv-300 rtl:group-hover:-translate-x-1" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="shell mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          disabled={edges.start}
          aria-label={copy.previous}
          className="grid size-11 place-items-center border border-line-strong transition-colors hover:border-uv-400 disabled:opacity-30"
        >
          <ArrowIcon className="size-4 -scale-x-100 rtl:scale-x-100" />
        </button>
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          disabled={edges.end}
          aria-label={copy.next}
          className="grid size-11 place-items-center border border-line-strong transition-colors hover:border-uv-400 disabled:opacity-30"
        >
          <ArrowIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
