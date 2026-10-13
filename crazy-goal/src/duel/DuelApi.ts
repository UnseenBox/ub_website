import type { CardId } from '../abilities/Cards';

export interface DuelPlayer {
  id: string;
  name: string;
}

export interface Identity extends DuelPlayer {
  secret: string;
}

/** A shot as it travels between players: the outcome, and the route so it can be shown. */
export interface ShotRecord {
  goal: boolean;
  score: number;
  /** Flat x, y pairs; a null pair is a break in the line (the ball went down a manhole). */
  path: (number | null)[];
  /** Where the goalkeeper stood at each point of the path, when there was one. */
  keeper: (number | null)[];
  /** The card played with this shot: a boost rode on it, a trick went to the other player. */
  card: CardId | null;
  /** What the street did during the shot, in groups of four (see Game.REPLAY_KINDS). */
  events: number[];
  /** Where the scooters were as the ball was struck. */
  movers: number[];
}

export interface DuelRound {
  /** Each player's one shot of the round, by side. */
  shot: [ShotRecord | null, ShotRecord | null];
}

export type DuelMode = 'classic' | 'quick' | 'pure';

export interface DuelData {
  id: string;
  seed: number;
  /** Missing on duels from before modes: those play as Classic. */
  mode?: DuelMode;
  players: [DuelPlayer, DuelPlayer];
  rounds: DuelRound[];
  updatedAt: string;
}

/** A failure the player can be told about. `code` is the server's reason, or 'offline'. */
export class DuelApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const ENDPOINT: string = import.meta.env.VITE_DUEL_API ?? '/api/duel';
const IDENTITY_KEY = 'crazy-goal-duel-player';

/**
 * Talks to the duel server. One endpoint, an action per call. Duels only work where that
 * server exists (unseenbox.com); anywhere else every call fails as 'offline' and the game
 * says so instead of breaking.
 */
export class DuelApi {
  identity: Identity | null = null;

  private async call<T>(action: string, body: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
    } catch {
      throw new DuelApiError('offline');
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new DuelApiError('offline');
    }
    const parsed = data as { ok?: boolean; result?: T; error?: string };
    if (!response.ok || !parsed.ok || parsed.result === undefined) throw new DuelApiError(parsed.error ?? 'offline');
    return parsed.result;
  }

  private stored(): Partial<Identity> {
    try {
      const raw = localStorage.getItem(IDENTITY_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return typeof parsed === 'object' && parsed !== null ? (parsed as Partial<Identity>) : {};
    } catch {
      return {};
    }
  }

  /** Gets this browser's player, creating one the first time. Pass a name to change it. */
  async hello(name?: string): Promise<Identity> {
    const known = this.stored();
    const identity = await this.call<Identity>('hello', { id: known.id, secret: known.secret, name: name ?? known.name });
    this.identity = identity;
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } catch {
      /* without storage the id lasts for this visit only */
    }
    return identity;
  }

  private auth(): { id: string; secret: string } {
    if (!this.identity) throw new DuelApiError('offline');
    return { id: this.identity.id, secret: this.identity.secret };
  }

  challenge(opponent: string, mode: DuelMode = 'classic'): Promise<DuelData> {
    return this.call('challenge', { ...this.auth(), opponent, mode });
  }

  list(): Promise<DuelData[]> {
    return this.call('list', this.auth());
  }

  get(duel: string): Promise<DuelData> {
    return this.call('get', { ...this.auth(), duel });
  }

  /** Records this player's shot of a round. A round opens once both shots of the one before are in. */
  move(duel: string, round: number, data: ShotRecord): Promise<DuelData> {
    return this.call('move', { ...this.auth(), duel, round, data });
  }
}
