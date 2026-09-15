import "server-only";

import type { ShowcaseItem } from "@/components/home/worlds-showcase";
import type { SignalItem } from "@/components/games/signal-card";
import type { ServiceItem } from "@/components/home/services-index";
import type { ArchiveItem } from "@/components/experiences/archive-strip";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { localePath, t, type Locale } from "@/lib/i18n/config";
import { latestNote, parseTrailer, releaseYear, statusStage } from "@/lib/games";
import { formatMonth, stampDate } from "@/lib/utils";
import type { Experience, Game, Service } from "@/types/content";

/**
 * Presenters turn localized content into small, plain props for client
 * components — so no dictionaries or helpers ship to the browser.
 */

export function platformList(game: Game, dict: Dictionary) {
  return game.platforms.map((p) => dict.game.platforms[p]).join(" · ");
}

export function toShowcaseItem(game: Game, locale: Locale, dict: Dictionary): ShowcaseItem {
  return {
    slug: game.slug,
    title: game.title,
    tagline: t(game.tagline, locale),
    genre: t(game.genre, locale),
    platforms: platformList(game, dict),
    status: dict.game.statuses[game.status],
    year: releaseYear(game) || t(game.estimatedRelease, locale),
    cover: game.cover,
    poster: game.poster,
    href: localePath(locale, `/games/${game.slug}`),
    accent: game.accent || "#8f5bff",
    hasTrailer: parseTrailer(game.trailerUrl) !== null,
  };
}

export function toSignalItem(game: Game, locale: Locale, dict: Dictionary): SignalItem {
  const note = latestNote(game);
  return {
    slug: game.slug,
    title: game.title,
    tagline: t(game.tagline, locale),
    statusLabel: dict.game.statuses[game.status],
    stage: statusStage(game.status),
    eta: t(game.estimatedRelease, locale) || "—",
    progress: Math.max(0, Math.min(100, game.progress ?? 0)),
    cover: game.cover,
    href: localePath(locale, `/games/${game.slug}`),
    note: note ? { date: note.date, text: t(note.text, locale) } : null,
  };
}

export function toServiceItem(service: Service, locale: Locale): ServiceItem {
  return {
    id: service.id,
    title: t(service.title, locale),
    kicker: t(service.kicker, locale),
    description: t(service.description, locale),
    deliverables: service.deliverables.map((d) => t(d, locale)).filter(Boolean),
    glyph: service.glyph,
  };
}

export function toArchiveItem(item: Experience, locale: Locale, dict: Dictionary): ArchiveItem {
  return {
    slug: item.slug,
    title: t(item.title, locale),
    type: item.type,
    typeLabel: dict.experiences.types[item.type],
    stamp: stampDate(item.date),
    dateLabel: formatMonth(item.date, locale),
    location: t(item.location, locale),
    summary: t(item.summary, locale),
    cover: item.cover,
    href: localePath(locale, `/experiences/${item.slug}`),
  };
}
