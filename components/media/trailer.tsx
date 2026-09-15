"use client";

import { useState } from "react";
import { SmartImage } from "@/components/ui/smart-image";
import { PlayIcon } from "@/components/ui/icons";
import type { parseTrailer } from "@/lib/games";

type TrailerSource = NonNullable<ReturnType<typeof parseTrailer>>;

/**
 * Facade: shows a poster frame and loads the heavy player iframe only on
 * intent. Saves ~500KB+ of third-party JS on every game page.
 */
export function Trailer({
  source,
  poster,
  title,
  playLabel,
}: {
  source: TrailerSource;
  poster: string;
  title: string;
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    if (source.kind === "file") {
      return (
        <video className="aspect-video w-full bg-black" src={source.src} controls autoPlay playsInline>
          <track kind="captions" />
        </video>
      );
    }
    const src =
      source.kind === "youtube"
        ? `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0&modestbranding=1`
        : `https://player.vimeo.com/video/${source.id}?autoplay=1&dnt=1`;
    return (
      <iframe
        className="aspect-video w-full bg-black"
        src={src}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group frame relative block aspect-video w-full overflow-hidden bg-ink-900"
      aria-label={`${playLabel}: ${title}`}
      data-cursor={playLabel}
    >
      <SmartImage
        src={poster}
        alt=""
        sizes="(min-width: 1024px) 80vw, 100vw"
        className="opacity-70 transition-[transform,opacity] duration-[1200ms] ease-expo group-hover:scale-[1.03] group-hover:opacity-90"
      />
      <span aria-hidden className="scanlines absolute inset-0 opacity-40" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-20 place-items-center rounded-full border border-bone/40 bg-void/40 backdrop-blur-sm transition-[transform,background-color,border-color] duration-500 ease-expo group-hover:scale-110 group-hover:border-uv-400 group-hover:bg-uv-500 sm:size-28">
          <PlayIcon className="ms-1 size-7 sm:size-9" />
        </span>
      </span>
      <span className="label absolute bottom-4 start-4 text-bone">▶ {playLabel}</span>
    </button>
  );
}
