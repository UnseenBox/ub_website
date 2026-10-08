"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import type { PlayMood } from "@/lib/play";
import type { PortalGame } from "@/lib/play-portal";
import { GameCard, GameTile, type TileCopy } from "./game-tile";
import { CheckIcon, MoodIcon, SearchIcon } from "./icons";

interface PortalCopy extends TileCopy {
  title: string;
  intro: string;
  count: string;
  search: string;
  clear: string;
  topPicks: string;
  allGames: string;
  results: string;
  noResults: string;
  comingSoon: string;
  more: string;
  moodsLabel: string;
  moods: Record<PlayMood, string>;
  tags: string[];
  tagNotes: string[];
}

/** Each mood card is lit in its own colour. */
const MOOD_HUES: Record<PlayMood, string> = {
  quick: "#f5b83d",
  brain: "#3fd0c0",
  chaos: "#ff5f7a",
  friends: "#5aa9ff",
  dark: "#b08bff",
  phone: "#7ddc6f",
};

/** The mosaic holds one large tile and up to this many small ones. */
const MOSAIC_SMALL = 4;

/** Lowercase and strip accents and Arabic vowel marks, so a search is forgiving. */
function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u0652\u0670]/g, "")
    .toLowerCase();
}

const heading = "flex items-center gap-3 text-xl font-semibold tracking-tight text-white sm:text-2xl";

/**
 * The arcade's front page: search, moods to browse by, a mosaic of picks and every game
 * as a card. Each tile leads to the game's own page, where it is played.
 */
export function PlayPortal({
  games,
  moods,
  countLabel,
  copy,
}: {
  games: PortalGame[];
  /** Moods that at least one game belongs to, in display order. */
  moods: PlayMood[];
  /** The number of games, already padded for display. */
  countLabel: string;
  copy: PortalCopy;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<PlayMood | null>(null);

  // Games used to be sections of this page, so links such as /play#bonk are still out there.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;
    const game = games.find(({ slug }) => hash === slug || hash === `${slug}-reviews`);
    if (game) router.replace(hash === game.slug ? game.href : `${game.href}#reviews`);
  }, [games, router]);

  const haystacks = useMemo(
    () =>
      new Map(
        games.map((game) => [
          game.slug,
          fold([game.title, game.genre, game.summary, ...game.moods.map((key) => copy.moods[key])].join(" ")),
        ]),
      ),
    [games, copy.moods],
  );

  const words = fold(query).split(/\s+/).filter(Boolean);
  const filtering = words.length > 0 || mood !== null;
  const shown = games.filter(
    (game) => (!mood || game.moods.includes(mood)) && words.every((word) => haystacks.get(game.slug)!.includes(word)),
  );

  const [lead, ...others] = games;
  const picks = others.slice(0, MOSAIC_SMALL);

  function reset() {
    setQuery("");
    setMood(null);
  }

  return (
    <div className="relative isolate overflow-x-clip">
      <div aria-hidden className="uv-glow pointer-events-none absolute inset-x-0 -top-72 -z-10 h-[46rem] opacity-60" />

      <div className="shell pb-24 pt-24 sm:pb-28 sm:pt-28">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-4xl sm:text-5xl">{copy.title}</h1>
            <p className="mt-3 max-w-xl leading-relaxed text-mist">{copy.intro}</p>
          </div>

          <div className="flex w-full items-center gap-3 lg:w-auto">
            <label className="relative block min-w-0 flex-1 lg:w-96 lg:flex-none">
              <span className="sr-only">{copy.search}</span>
              <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-fog" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                autoComplete="off"
                enterKeyHint="search"
                className="h-12 w-full rounded-full border border-line-strong bg-ink-800 pe-12 ps-12 text-bone transition-colors placeholder:text-fog hover:border-fog focus:border-uv-400 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={copy.clear}
                  className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-mist transition-colors hover:bg-ink-600 hover:text-bone"
                >
                  <CloseIcon className="size-4" />
                </button>
              )}
            </label>
            <p className="hidden h-12 shrink-0 items-center gap-2.5 rounded-full bg-ink-800 px-5 text-sm text-mist ring-1 ring-line sm:flex">
              <span className="size-2 rounded-full bg-uv-500 animate-pulse-uv" aria-hidden />
              <span className="font-pixel text-base text-bone" dir="ltr">
                {countLabel}
              </span>
              {copy.count}
            </p>
          </div>
        </header>

        <div
          role="group"
          aria-label={copy.moodsLabel}
          className="scrollbar-none mt-8 grid auto-cols-[minmax(9.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto"
        >
          {moods.map((key) => {
            const hue = MOOD_HUES[key];
            const active = mood === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setMood(active ? null : key)}
                style={{
                  background: `linear-gradient(135deg, color-mix(in oklab, ${hue} ${active ? 46 : 26}%, #0c0b10), #13111a 80%)`,
                  boxShadow: `inset 0 0 0 ${active ? 2 : 1}px color-mix(in oklab, ${hue} ${active ? 90 : 22}%, transparent)`,
                  color: `color-mix(in oklab, ${hue} 72%, white)`,
                }}
                className="group/mood relative flex h-24 flex-col justify-end overflow-hidden rounded-xl p-4 text-start transition-[filter] duration-300 hover:brightness-125"
              >
                <MoodIcon
                  mood={key}
                  className="absolute end-3 top-3 size-9 transition-[scale,rotate] duration-500 ease-expo group-hover/mood:-rotate-6 group-hover/mood:scale-110"
                />
                <span className="font-semibold leading-tight">{copy.moods[key]}</span>
              </button>
            );
          })}
        </div>

        {!filtering && lead && (
          <section aria-labelledby="play-picks" className="mt-12">
            <h2 id="play-picks" className={heading}>
              {copy.topPicks}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <GameTile
                game={lead}
                copy={copy}
                lead
                eager
                sizes="(min-width: 640px) 50vw, 100vw"
                className="col-span-2 aspect-video sm:row-span-2 sm:aspect-auto"
              />
              {picks.map((game) => (
                <GameTile
                  key={game.slug}
                  game={game}
                  copy={copy}
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="aspect-video"
                />
              ))}
              {picks.length < MOSAIC_SMALL && (
                <div className="flex aspect-video flex-col justify-between rounded-xl border border-dashed border-line-strong bg-ink-950 p-3 [background-image:radial-gradient(rgb(143_91_255/0.2)_1px,transparent_1px)] [background-size:12px_12px] sm:p-4">
                  <span className="self-start rounded-md bg-ink-700 px-2 py-1 text-[0.65rem] font-bold uppercase leading-none tracking-wider text-uv-300">
                    {copy.comingSoon}
                  </span>
                  <p className="text-sm leading-snug text-mist sm:text-base">{copy.more}</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section aria-labelledby="play-all" className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="play-all" className={heading}>
              {mood ? copy.moods[mood] : filtering ? copy.results : copy.allGames}
              <span
                aria-live="polite"
                className="rounded-full bg-ink-700 px-2.5 py-0.5 text-sm font-medium text-mist"
                dir="ltr"
              >
                {shown.length}
              </span>
            </h2>
            {filtering && (
              <button
                type="button"
                onClick={reset}
                className="flex h-9 items-center gap-2 rounded-full bg-ink-700 pe-4 ps-3 text-sm font-medium text-bone transition-colors hover:bg-ink-600"
              >
                <CloseIcon className="size-4" />
                {copy.clear}
              </button>
            )}
          </div>

          {shown.length > 0 ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {shown.map((game) => (
                <li key={game.slug}>
                  <GameCard game={game} copy={copy} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center text-mist">
              {copy.noResults}
            </p>
          )}
        </section>

        <section
          aria-label={copy.count}
          className="mt-16 grid gap-8 rounded-2xl bg-ink-900 p-6 ring-1 ring-line sm:p-8 lg:grid-cols-[1fr_2fr] lg:items-center"
        >
          <p className="font-display text-2xl text-balance sm:text-3xl">{copy.more}</p>
          <ul className="grid gap-6 sm:grid-cols-3">
            {copy.tags.map((tag, i) => (
              <li key={tag} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-uv-900 text-uv-300">
                  <CheckIcon className="size-4" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{tag}</span>
                  {copy.tagNotes[i] && <span className="mt-1 block text-sm text-mist">{copy.tagNotes[i]}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
