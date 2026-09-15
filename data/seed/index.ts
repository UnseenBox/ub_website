import type { SiteContent } from "@/types/content";
import { experiences } from "./experiences";
import { releasedGames } from "./games-released";
import { upcomingGames } from "./games-upcoming";
import { SEED_DATE } from "./helpers";
import { services } from "./services";
import { studio } from "./studio";

/**
 * Initial content. Used until the first admin save creates a stored copy,
 * and as a safety net if storage is unreachable.
 */
export const seedContent: SiteContent = {
  version: 1,
  updatedAt: SEED_DATE,
  studio,
  games: [...releasedGames, ...upcomingGames],
  services,
  experiences,
};
