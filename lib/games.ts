import type { Game, GameStatus } from "@/types/content";

/** Position on the Concept → Launch track (0–5). */
export function statusStage(status: GameStatus): number {
  switch (status) {
    case "concept":
      return 0;
    case "prototype":
      return 1;
    case "production":
      return 2;
    case "alpha":
      return 3;
    case "beta":
      return 4;
    default:
      return 5;
  }
}

export function releaseYear(game: Game): string {
  return game.releaseDate?.slice(0, 4) ?? "";
}

export function latestNote(game: Game) {
  return [...game.devNotes].sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** YouTube / Vimeo / direct video detection for trailer embeds. */
export function parseTrailer(url: string | undefined):
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "file"; src: string }
  | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return { kind: "youtube", id: u.pathname.slice(1) };
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      return id ? { kind: "youtube", id } : null;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? { kind: "vimeo", id } : null;
    }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "file", src: url };
  } catch {
    return null;
  }
  return null;
}
