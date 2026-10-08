import { PlayIcon } from "@/components/ui/icons";
import { SmartImage } from "@/components/ui/smart-image";
import type { PlayBadge, PortalGame } from "@/lib/play-portal";
import { cn } from "@/lib/utils";
import { GameLink } from "./game-link";
import { StarIcon } from "./icons";

export interface TileCopy {
  start: string;
  badges: Record<PlayBadge, string>;
}

function Badges({ game, copy }: { game: PortalGame; copy: TileCopy }) {
  if (game.badges.length === 0) return null;
  return (
    <span className="absolute start-2.5 top-2.5 z-10 flex gap-1.5">
      {game.badges.map((badge) => (
        <span
          key={badge}
          className={cn(
            "rounded-md px-2 py-1 text-[0.65rem] font-bold uppercase leading-none tracking-wider shadow-md",
            badge === "new" ? "bg-uv-500 text-white" : "bg-amber-300 text-void",
          )}
        >
          {copy.badges[badge]}
        </span>
      ))}
    </span>
  );
}

/**
 * A game as a picture: the poster with its name over it. `lead` is the large tile
 * that opens the mosaic.
 */
export function GameTile({
  game,
  copy,
  sizes,
  lead = false,
  eager = false,
  className,
}: {
  game: PortalGame;
  copy: TileCopy;
  sizes: string;
  lead?: boolean;
  /** For a tile that is on screen as the page opens. */
  eager?: boolean;
  className?: string;
}) {
  return (
    <GameLink
      slug={game.slug}
      href={game.href}
      aria-label={`${copy.start}: ${game.title}`}
      className={cn(
        "group/tile relative isolate block overflow-hidden rounded-xl bg-ink-800 ring-1 ring-line",
        "transition-[scale,box-shadow] duration-300 ease-expo",
        "hover:z-10 hover:scale-[1.025] hover:shadow-[0_16px_44px_-12px_rgb(143_91_255/0.6)] hover:ring-2 hover:ring-uv-400",
        "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-uv-400",
        className,
      )}
    >
      <SmartImage src={game.poster} alt="" sizes={sizes} loading={eager ? "eager" : undefined} />
      <Badges game={game} copy={copy} />
      {/* Posters carry their own lettering, so the name only comes up when the tile is pointed at. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 flex translate-y-2 items-end justify-between gap-3 bg-gradient-to-t from-void via-void/85 to-transparent opacity-0",
          "transition-[opacity,translate] duration-300 ease-expo",
          "group-hover/tile:translate-y-0 group-hover/tile:opacity-100 group-focus-visible/tile:translate-y-0 group-focus-visible/tile:opacity-100",
          lead ? "p-4 pt-16 sm:p-6 sm:pt-24" : "p-3 pt-10",
        )}
      >
        <span className="min-w-0">
          <span className={cn("block truncate font-semibold text-white", lead ? "text-xl sm:text-3xl" : "text-sm sm:text-base")}>
            <span dir="ltr">{game.title}</span>
          </span>
          <span className={cn("block truncate text-bone/75", lead ? "mt-1 text-sm sm:text-base" : "text-xs")}>
            {game.genre}
          </span>
        </span>
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-uv-500 text-white",
            lead ? "size-12 sm:size-14" : "size-9",
          )}
        >
          <PlayIcon className={cn("rtl:-scale-x-100", lead ? "size-6" : "size-4")} />
        </span>
      </span>
    </GameLink>
  );
}

/**
 * A game with its pitch: poster, name, genre, a few lines about it and its rating.
 * On phones it is a compact row, since the mosaic above has already shown the posters large.
 */
export function GameCard({ game, copy }: { game: PortalGame; copy: TileCopy }) {
  return (
    <GameLink
      slug={game.slug}
      href={game.href}
      aria-label={`${copy.start}: ${game.title}`}
      className={cn(
        "group/card flex h-full gap-3.5 overflow-hidden rounded-xl bg-ink-900 p-3 ring-1 ring-line sm:flex-col sm:gap-0 sm:p-0",
        "transition-[translate,background-color,box-shadow] duration-300 ease-expo",
        "hover:-translate-y-1 hover:bg-ink-800 hover:ring-uv-400/80",
      )}
    >
      <div className="relative aspect-video w-32 shrink-0 self-start overflow-hidden rounded-lg bg-ink-800 sm:w-full sm:rounded-none">
        <SmartImage
          src={game.poster}
          alt=""
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 8rem"
          className="transition-transform duration-700 ease-expo group-hover/card:scale-105"
        />
        <span className="max-sm:hidden">
          <Badges game={game} copy={copy} />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-white sm:text-lg">
              <span dir="ltr">{game.title}</span>
            </h3>
            <p className="mt-0.5 truncate text-sm text-uv-300">{game.genre}</p>
          </div>
          {game.rating && (
            <p className="flex shrink-0 items-center gap-1 pt-0.5 text-sm font-semibold text-bone sm:pt-1" dir="ltr">
              <StarIcon className="size-4 text-amber-300" />
              {game.rating.average.toFixed(1)}
            </p>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-mist sm:mt-3 sm:line-clamp-3">{game.summary}</p>
        <div className="mt-auto pt-4 max-sm:hidden">
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-uv-500 pe-4 ps-3 text-sm font-semibold text-white transition-colors duration-300 group-hover/card:bg-uv-400">
            <PlayIcon className="size-4 rtl:-scale-x-100" />
            {copy.start}
          </span>
        </div>
      </div>
    </GameLink>
  );
}
