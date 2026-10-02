"use client";

import { useRef, useState } from "react";
import { SmartImage } from "@/components/ui/smart-image";
import { CloseIcon, ExternalIcon, PlayIcon } from "@/components/ui/icons";

interface GamePlayerProps {
  title: string;
  src: string;
  poster: string;
  copy: { start: string; fullscreen: string; newTab: string; close: string; externalLink: string };
}

/**
 * Click-to-load player for a browser game. Nothing is downloaded until the visitor
 * presses play. On touch devices the game opens as its own page instead: it needs
 * the whole screen and its own gestures, which an embedded frame cannot give it.
 */
export function GamePlayer({ title, src, poster, copy }: GamePlayerProps) {
  const [started, setStarted] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

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
    <div>
      <div ref={frame} className="frame relative aspect-[16/10] w-full overflow-hidden bg-ink-900">
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
            data-cursor={copy.start}
            aria-label={`${copy.start} — ${title}`}
            className="group absolute inset-0 block size-full cursor-pointer text-start"
          >
            <SmartImage
              src={poster}
              alt=""
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="transition-transform duration-[1200ms] ease-expo group-hover:scale-[1.03]"
            />
            <span aria-hidden className="scanlines pointer-events-none absolute inset-0 opacity-30" />
            <span
              aria-hidden
              className="absolute inset-0 bg-void/45 transition-colors duration-500 group-hover:bg-void/20"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-4 bg-bone ps-5 pe-7 text-void transition-colors duration-300 group-hover:bg-uv-500 group-hover:text-white group-focus-visible:bg-uv-500 group-focus-visible:text-white">
                <PlayIcon className="size-6 rtl:-scale-x-100" />
                <span className="py-4 font-mono text-[0.8rem] uppercase tracking-[0.18em]">{copy.start}</span>
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {started && (
          <>
            <button type="button" onClick={fullscreen} className="label hover:text-bone">
              {copy.fullscreen}
            </button>
            <button type="button" onClick={() => setStarted(false)} className="label flex items-center gap-2 hover:text-bone">
              <CloseIcon className="size-3.5" />
              {copy.close}
            </button>
          </>
        )}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="label ms-auto flex items-center gap-2 hover:text-bone"
        >
          {copy.newTab}
          <ExternalIcon className="size-3.5" />
          <span className="sr-only"> ({copy.externalLink})</span>
        </a>
      </div>
    </div>
  );
}
