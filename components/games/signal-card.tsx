"use client";

import Link from "next/link";
import { useState } from "react";
import { SmartImage } from "@/components/ui/smart-image";
import { ArrowIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface SignalItem {
  slug: string;
  title: string;
  tagline: string;
  statusLabel: string;
  stage: number;
  eta: string;
  progress: number;
  cover: string;
  href: string;
  note: { date: string; text: string } | null;
}

interface Copy {
  signal: string;
  eta: string;
  stage: string;
  lastLog: string;
  enhance: string;
  follow: string;
  stages: string[];
}

const BLOCKS = 20;

/**
 * An upcoming world as an intercepted transmission: the artwork arrives as a
 * low-resolution signal (a ~64px image scaled up) and only "develops" into
 * full resolution when someone leans in. The sharp image isn't requested
 * until then.
 */
export function SignalCard({ item, copy, index }: { item: SignalItem; copy: Copy; index: number }) {
  const [enhanced, setEnhanced] = useState(false);
  const [requested, setRequested] = useState(false);
  const lit = Math.round((item.progress / 100) * BLOCKS);

  const enhance = (on: boolean) => {
    if (on) setRequested(true);
    setEnhanced(on);
  };

  return (
    <article
      data-reveal
      className="group grid gap-8 border-t border-line py-10 sm:py-14 lg:grid-cols-[1.25fr_1fr] lg:gap-14"
      onMouseEnter={() => enhance(true)}
      onMouseLeave={() => enhance(false)}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => enhance(!enhanced)}
          onFocus={() => enhance(true)}
          onBlur={() => enhance(false)}
          aria-pressed={enhanced}
          aria-label={`${copy.enhance}: ${item.title}`}
          className="frame relative block aspect-[16/9] w-full overflow-hidden bg-ink-900 text-start"
        >
          {/* Low signal */}
          <SmartImage
            src={item.cover}
            alt=""
            sizes="64px"
            quality={60}
            className="scale-105 [image-rendering:pixelated] saturate-[0.6]"
          />
          {/* Developed */}
          {requested && (
            <div
              className={cn(
                "absolute inset-0 transition-[clip-path,opacity] duration-[1100ms] ease-expo",
                enhanced ? "opacity-100 [clip-path:inset(0_0_0_0)]" : "opacity-0 [clip-path:inset(0_0_100%_0)]",
              )}
            >
              <SmartImage src={item.cover} alt="" sizes="(min-width: 1024px) 55vw, 100vw" />
            </div>
          )}
          <span aria-hidden className="scanlines absolute inset-0 opacity-60" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-void/80 via-transparent to-void/30" />

          <span aria-hidden className="label absolute start-4 top-4 flex items-center gap-2 text-bone">
            <span className="size-2 rounded-full bg-uv-500 animate-pulse-uv" />
            TX.0{index + 1}
          </span>
          <span aria-hidden className="font-pixel absolute end-4 top-4 text-xs text-uv-300" dir="ltr">
            {copy.signal} {enhanced ? "100" : item.progress}%
          </span>
          <span
            aria-hidden
            className={cn(
              "label absolute bottom-4 start-4 transition-opacity duration-500",
              enhanced ? "opacity-0" : "opacity-100",
            )}
          >
            ◌ {copy.enhance}
          </span>
        </button>
      </div>

      <div className="flex flex-col">
        <ol className="flex flex-wrap gap-x-3 gap-y-2" aria-label={copy.stage}>
          {copy.stages.map((stage, i) => (
            <li
              key={stage}
              aria-current={i === item.stage ? "step" : undefined}
              className={cn(
                "font-pixel flex items-center gap-1.5 text-[0.62rem] uppercase",
                i === item.stage ? "text-uv-300" : i < item.stage ? "text-mist" : "text-fog/60",
              )}
            >
              <span className={cn("size-1.5", i <= item.stage ? "bg-current" : "border border-current")} />
              {stage}
            </li>
          ))}
        </ol>

        <h3 className="font-display mt-6 text-title">
          <Link href={item.href} className="glitch transition-colors hover:text-uv-300" data-text={item.title}>
            {item.title}
          </Link>
        </h3>
        <p className="mt-4 max-w-lg text-lg text-mist">{item.tagline}</p>

        <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-6">
          <div>
            <dt className="label">{copy.stage}</dt>
            <dd className="mt-1.5 text-bone">{item.statusLabel}</dd>
          </div>
          <div>
            <dt className="label">{copy.eta}</dt>
            <dd className="mt-1.5 text-bone">{item.eta}</dd>
          </div>
          <div className="col-span-2">
            <dt className="label flex justify-between">
              <span>{copy.signal}</span>
              <span className="font-pixel text-uv-300" dir="ltr">
                {item.progress}%
              </span>
            </dt>
            <dd className="mt-3">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.progress}
                aria-label={copy.signal}
                className="flex gap-1"
              >
                {Array.from({ length: BLOCKS }, (_, i) => (
                  <span
                    key={i}
                    className={cn("h-3 flex-1 transition-colors duration-500", i < lit ? "bg-uv-500" : "bg-ink-700")}
                    style={{ transitionDelay: `${i * 25}ms` }}
                  />
                ))}
              </div>
            </dd>
          </div>
        </dl>

        {item.note && (
          <div className="mt-8 border border-line bg-ink-950/60 p-4 font-mono text-[0.8rem] leading-relaxed text-mist">
            <p className="label mb-2 text-uv-300">
              {copy.lastLog} · <time dateTime={item.note.date}>{item.note.date}</time>
            </p>
            <p>
              <span className="text-uv-400">&gt; </span>
              {item.note.text}
              <span aria-hidden className="ms-1 inline-block h-3.5 w-2 translate-y-0.5 animate-blink bg-uv-400" />
            </p>
          </div>
        )}

        <Link
          href={item.href}
          className="label group/link mt-8 inline-flex items-center gap-2 self-start text-bone hover:text-uv-300"
        >
          {copy.follow}
          <ArrowIcon className="size-4 transition-transform duration-500 ease-expo group-hover/link:translate-x-1 rtl:group-hover/link:-translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
