/**
 * `window.CrazyKoraShell`: the one published interface between Classic and the Free Kicks module.
 *
 * Free Kicks (free-kicks/, plain scripts that are not bundled) never imports Classic. It asks this
 * object for the shared wallet, star total, ball, sound settings and portal signals, and it hands
 * results back through it. Classic stays the only writer of `crazy-goal-save`; Free Kicks keeps
 * writing only its own `crazy-kora-fk-progress` and `crazy-kora-fk-tutorial`.
 *
 * The shell is created in main.ts right after the Game, before the deferred Free Kicks scripts
 * run (same ordering argument as `window.CrazyKoraAssets`, see docs/FREE_KICKS.md section 2).
 */
import type { Game } from '../core/Game';
import { lang } from '../core/i18n';
import { applyDaily, dateKey, fkStagePayout, previousDay } from '../progression/Progression';
import { portal } from '../portal/Portal';
import { fkStarMax, fkStars } from './fkProgress';

export interface CrazyKoraShell {
  version: 1;
  lang: 'en' | 'ar';
  wallet: {
    coins(): number;
    /** Adds Kora Coins to the shared wallet. `reason` is for analytics ("fk-stage", "daily"...). */
    earn(n: number, reason: string): void;
  };
  stars: {
    classic(): number;
    freeKicks(): number;
    total(): number;
    max(): number;
  };
  fk: {
    /** Reports a finished Street Cup stage; returns the coins it paid (0 for a repeat or a worse run). */
    recordStage(stageId: string, stars: number): number;
  };
  daily: {
    /** Today's local date, `YYYY-MM-DD` (in a development build `?today=YYYY-MM-DD` overrides it, to test a date change). */
    today(): string;
    /** Whether today's scored attempt is in, the streak, and today's five results as a line (or ''). */
    state(): { date: string; done: boolean; streak: number; line: string };
    /**
     * Records the Daily Kick's one scored attempt for `date` and pays for it.
     * `already` is true when it was in before: nothing changes then.
     */
    record(date: string, goals: number, line: string): { already: boolean; streak: number; coins: number };
  };
  /** The ball the player chose, for the arena to draw. */
  skin(): { id: string; colors: { base: string; patch: string; seam?: string } };
  audio: {
    muted(): boolean;
    /** The sound volume, 0 to 1. */
    volume(): number;
    /** Called when Classic mutes or the volume changes. Returns the unsubscribe function. */
    onChange(cb: (muted: boolean, volume: number) => void): () => void;
  };
  portal: {
    gameplayStart(): void;
    gameplayStop(): void;
  };
  /** Opens the settings card over whatever is showing; `onClose` runs when the player leaves it. */
  openSettings(onClose?: () => void): void;
  /** Closes that card as BACK would (for Escape). Does nothing when it is not open. */
  closeSettings(): void;
  menu: {
    /** Free Kicks tells the main menu how to open it; the menu draws the tile. */
    registerModeTile(id: 'freeKicks', open: () => void): void;
    /** Free Kicks changed something the tile shows (a new star, today's Daily Kick done). */
    refresh(): void;
  };
}

declare global {
  interface Window {
    CrazyKoraShell?: CrazyKoraShell;
  }
}

/** Today's local date. A development build lets `?today=YYYY-MM-DD` stand in, so a date change can be tested. */
function todayKey(): string {
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(location.search).get('today');
    if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return forced;
  }
  return dateKey(new Date());
}

/** Builds the shell around a running Game and publishes it on `window`. */
export function installShell(game: Game): CrazyKoraShell {
  const shell: CrazyKoraShell = {
    version: 1,
    lang,
    wallet: {
      coins: () => game.save.data.coins,
      earn: (n, reason) => game.earnCoins(n, reason),
    },
    stars: {
      classic: () => game.classicStars(),
      freeKicks: () => fkStars(),
      total: () => game.classicStars() + fkStars(),
      max: () => game.levels.length * 3 + fkStarMax(),
    },
    fk: {
      recordStage(stageId, stars) {
        if (typeof stageId !== 'string' || !stageId) return 0;
        const s = Math.max(0, Math.min(3, Math.floor(Number(stars)) || 0));
        const ledger = game.save.data.fk.coinsPaid;
        const paid = ledger[stageId] ?? 0;
        const coins = fkStagePayout(s, paid);
        if (coins > 0) {
          ledger[stageId] = paid + coins;
          game.earnCoins(coins, 'fk-stage');
        }
        // A new star may open a ball or the Legend tile: let the menu and the skins notice.
        game.starsChanged();
        return coins;
      },
    },
    daily: {
      today: () => todayKey(),
      state() {
        const date = todayKey();
        const d = game.save.data.daily;
        // The streak only counts while it is alive: today's, or yesterday's still waiting to be extended.
        return { date, done: d.results[date] !== undefined, streak: d.results[date] !== undefined || d.lastDate === previousDay(date) ? d.streak : 0, line: d.results[date] ?? '' };
      },
      record(date, goals, line) {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof line !== 'string') return { already: true, streak: 0, coins: 0 };
        const out = applyDaily(game.save.data.daily, date, Number(goals), line.slice(0, 24));
        if (!out.already) {
          game.save.data.daily = out.state;
          game.earnCoins(out.coins, 'daily');
          game.save.save();
          game.refreshMenu();
        }
        return { already: out.already, streak: out.streak, coins: out.coins };
      },
    },
    skin: () => {
      const { id, base, patch } = game.skin;
      return { id, colors: { base, patch } };
    },
    audio: {
      muted: () => game.save.data.muted,
      volume: () => game.save.data.sound,
      onChange(cb) {
        game.audioListeners.add(cb);
        return () => {
          game.audioListeners.delete(cb);
        };
      },
    },
    portal: {
      gameplayStart: () => portal.gameplayStart(),
      gameplayStop: () => portal.gameplayStop(),
    },
    openSettings: (onClose) => game.openSettings(onClose),
    closeSettings: () => game.closeSettings(),
    menu: {
      registerModeTile: (id, open) => game.registerModeTile(id, open),
      refresh: () => game.refreshMenu(),
    },
  };
  window.CrazyKoraShell = shell;
  return shell;
}
