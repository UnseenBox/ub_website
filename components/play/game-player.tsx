"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, ExternalIcon, PlayIcon } from "@/components/ui/icons";
import { SmartImage } from "@/components/ui/smart-image";
import { clearAutostart, wantsAutostart } from "./autostart";
import { FullscreenIcon, StarIcon } from "./icons";

interface GamePlayerProps {
  slug: string;
  title: string;
  genre: string;
  src: string;
  poster: string;
  /** Average rating, shown in the bar as a shortcut to the reviews. */
  rating?: number;
  reviewsHref: string;
  copy: { start: string; fullscreen: string; newTab: string; close: string; externalLink: string };
}

const barButton =
  "grid size-10 place-items-center rounded-full text-mist transition-colors hover:bg-ink-700 hover:text-bone";

/**
 * Click-to-load player for a browser game, with the bar that sits under it. Nothing is
 * downloaded until the visitor asks to play, here or on a tile that led here. On touch
 * devices the game opens as its own page instead: it needs the whole screen and its own
 * gestures, which an embedded frame cannot give it.
 */
export function GamePlayer({ slug, title, genre, src, poster, rating, reviewsHref, copy }: GamePlayerProps) {
  const [started, setStarted] = useState(() => wantsAutostart(slug));
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearAutostart();
  }, []);

  function start() {
    if (window.matchMedia("(pointer: coarse)").matches) {
      window.location.assign(src);
      return;
    }
    setStarted(true);
  }

  function fullscreen() {
    const node = frame.current;
    if (!node) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void node.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-ink-900 ring-1 ring-line">
      <div ref={frame} className="relative aspect-[16/10] max-h-[calc(100dvh-11rem)] w-full bg-black">
        {started ? (
          <iframe
            src={src}
            title={title}
            allow="fullscreen; autoplay; gamepad"
            className="absolute inset-0 size-full border-0"
            onLoad={(event) => event.currentTarget.focus()}
          />
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={`${copy.start}: ${title}`}
            className="group absolute inset-0 block size-full cursor-pointer"
          >
            <SmartImage
              src={poster}
              alt=""
              sizes="(min-width: 1024px) 70vw, 100vw"
              loading="eager"
              className="transition-transform duration-[1200ms] ease-expo group-hover:scale-[1.03]"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-void/50 transition-colors duration-500 group-hover:bg-void/25"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-3 rounded-full bg-uv-500 py-4 pe-8 ps-6 text-lg font-semibold text-white shadow-[0_12px_44px_-8px_rgb(143_91_255/0.85)] transition-[scale,background-color] duration-300 ease-expo group-hover:scale-105 group-hover:bg-uv-400 group-focus-visible:bg-uv-400">
                <PlayIcon className="size-6 rtl:-scale-x-100" />
                {copy.start}
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 py-2 pe-2 ps-3 sm:ps-4">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-ink-800">
          <SmartImage src={poster} alt="" sizes="2.5rem" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">
            <span dir="ltr">{title}</span>
          </p>
          <p className="truncate text-xs text-mist">{genre}</p>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-0.5">
          {rating !== undefined && (
            <a
              href={reviewsHref}
              className="me-1 flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-bone transition-colors hover:bg-ink-700"
              dir="ltr"
            >
              <StarIcon className="size-4 text-amber-300" />
              {rating.toFixed(1)}
            </a>
          )}
          {started && (
            <>
              <button type="button" onClick={fullscreen} aria-label={copy.fullscreen} title={copy.fullscreen} className={barButton}>
                <FullscreenIcon className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setStarted(false)}
                aria-label={copy.close}
                title={copy.close}
                className={barButton}
              >
                <CloseIcon className="size-5" />
              </button>
            </>
          )}
          <a href={src} target="_blank" rel="noopener noreferrer" title={copy.newTab} className={barButton}>
            <ExternalIcon className="size-5" />
            <span className="sr-only">
              {copy.newTab} ({copy.externalLink})
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
