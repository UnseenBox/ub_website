import type { Game } from '../core/Game';
import type { RoomStats } from './ScoreSystem';

export interface ChallengeDefinition {
  readonly id: string;
  readonly text: string;
  /** Two-word sticky-note version; the full text lives in tooltips. */
  readonly short: string;
  readonly bonus: number;
  /** Evaluated when the room is cleared. */
  readonly passed: (stats: RoomStats) => boolean;
  /** Optional early-out so the HUD can show a challenge as already lost. */
  readonly failed?: (stats: RoomStats) => boolean;
}

const OFFICE_OBJECTS = new Set(['computer', 'book', 'chair', 'trashcan', 'lamp', 'fan', 'paperball']);

export const CHALLENGES: readonly ChallengeDefinition[] = [
  {
    id: 'one_object', text: 'KILL EVERYONE USING ONE OBJECT', short: '1 OBJECT', bonus: 1200,
    passed: (s) => s.objectsUsed.size <= 1, failed: (s) => s.objectsUsed.size > 1,
  },
  {
    id: 'environment_only', text: 'USE ONLY THE ENVIRONMENT', short: 'HANDS OFF', bonus: 1200,
    passed: (s) => s.impactKills === 0, failed: (s) => s.impactKills > 0,
  },
  {
    id: 'no_direct_hits', text: 'NO DIRECT HITS', short: 'INDIRECT ONLY', bonus: 1000,
    passed: (s) => s.directHits === 0, failed: (s) => s.directHits > 0,
  },
  { id: 'kill_with_book', text: 'KILL WITH A BOOK', short: 'BOOK KILL', bonus: 800, passed: (s) => s.bookKills > 0 },
  { id: 'chain_reactions_3', text: 'TRIGGER 3 CHAIN REACTIONS', short: '3 CHAINS', bonus: 1500, passed: (s) => s.chainEvents >= 3 },
  {
    id: 'defeat_heavy', text: 'FLATTEN THE CRATE WITHOUT GETTING HIT', short: 'BIG ONE, CLEAN', bonus: 1000,
    passed: (s) => s.heavyKills > 0 && s.damageTaken === 0, failed: (s) => s.damageTaken > 0,
  },
  { id: 'one_throw_two', text: 'ONE THROW, TWO MOVERS', short: '1 THROW, 2 OUT', bonus: 1200, passed: (s) => s.bestMultiKill >= 2 },
  { id: 'chain_4', text: 'TRIGGER A 4-STEP CHAIN REACTION', short: '4-STEP CHAIN', bonus: 1500, passed: (s) => s.bestChain >= 4 },
  {
    id: 'no_chair', text: 'CLEAR THE ROOM WITHOUT THROWING A CHAIR', short: 'NO CHAIRS', bonus: 800,
    passed: (s) => !s.objectIdsThrown.has('chair'), failed: (s) => s.objectIdsThrown.has('chair'),
  },
  {
    id: 'untouched', text: "DON'T GET HIT", short: 'UNTOUCHED', bonus: 800,
    passed: (s) => s.damageTaken === 0, failed: (s) => s.damageTaken > 0,
  },
  {
    id: 'office_only', text: 'USE ONLY OFFICE OBJECTS', short: 'OFFICE ONLY', bonus: 1000,
    passed: (s) => [...s.objectIdsThrown].every((id) => OFFICE_OBJECTS.has(id)),
    failed: (s) => [...s.objectIdsThrown].some((id) => !OFFICE_OBJECTS.has(id)),
  },
];

const BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

/** Challenges that make sense in any generated room (no specific object or enemy required). */
export const GENERIC_CHALLENGES: readonly string[] = [
  'one_object', 'environment_only', 'no_direct_hits', 'one_throw_two', 'untouched', 'no_chair', 'chain_reactions_3',
];

export type ChallengeStatus = 'open' | 'failed' | 'passed';

/** Optional bonus objective for the current room. */
export class ChallengeSystem {
  current: ChallengeDefinition | null = null;

  constructor(private readonly game: Game) {}

  setForRoom(id: string | undefined): void {
    this.current = id ? BY_ID.get(id) ?? null : null;
  }

  status(): ChallengeStatus {
    const challenge = this.current;
    if (!challenge) return 'open';
    return challenge.failed?.(this.game.score.stats) ? 'failed' : 'open';
  }

  /** Call when the room is cleared. Returns the bonus earned (0 if none). */
  resolve(): number {
    const challenge = this.current;
    if (!challenge || !challenge.passed(this.game.score.stats)) return 0;
    const save = this.game.save;
    if (!save.data.completedChallenges.includes(challenge.id)) {
      save.data.completedChallenges.push(challenge.id);
      save.write();
    }
    this.game.analytics.track('challenge_complete', { challenge: challenge.id });
    return challenge.bonus;
  }
}
