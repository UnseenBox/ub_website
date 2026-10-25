import { ABILITIES } from './Abilities';
import { LEDGER } from './StarLedger';
import { UPGRADES, nextUpgradeCost } from './Upgrades';

export type UnlockKind = 'store' | 'ledger' | 'done';
export type UnlockKicker = 'READY TO BUY' | 'NEXT STAR' | 'SAVE UP' | 'DONE';

export interface UnlockGoal {
  kind: UnlockKind;
  kicker: UnlockKicker;
  name: string;
  detail: string;
  /** 0–100, integer. */
  progress: number;
  action: 'store' | 'ledger' | null;
}

export interface ProgressionState {
  scrap: number;
  abilities: string[];
  upgrades: Record<string, number>;
}

interface StoreCandidate {
  /** Powers win cost ties against upgrades; both groups stay in catalog order. */
  kind: 'power' | 'upgrade';
  name: string;
  cost: number;
}

/** Powers first, then upgrades, each in catalog order. */
function storeCandidates(save: ProgressionState): StoreCandidate[] {
  const candidates: StoreCandidate[] = [];
  for (const ability of ABILITIES) {
    if (save.abilities.includes(ability.id)) continue;
    candidates.push({ kind: 'power', name: ability.name, cost: ability.cost });
  }
  for (const upgrade of UPGRADES) {
    const cost = nextUpgradeCost(save, upgrade.id);
    if (cost === null) continue;
    candidates.push({ kind: 'upgrade', name: upgrade.name, cost });
  }
  return candidates;
}

/** Cheapest candidate; a strict comparison keeps the earlier one on a tie. */
function cheapest(candidates: readonly StoreCandidate[]): StoreCandidate | null {
  let best: StoreCandidate | null = null;
  for (const candidate of candidates) {
    if (best === null || candidate.cost < best.cost) best = candidate;
  }
  return best;
}

function percent(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((100 * part) / whole)));
}

function ledgerGoal(
  milestone: (typeof LEDGER)[number],
  stars: number,
): UnlockGoal {
  const remaining = milestone.stars - stars;
  return {
    kind: 'ledger',
    kicker: 'NEXT STAR',
    name: milestone.name,
    detail: `${remaining} STARS TO GO · ${milestone.reward.toUpperCase()}`,
    progress: percent(stars, milestone.stars),
    action: 'ledger',
  };
}

function storeGoal(candidate: StoreCandidate, scrap: number, affordable: boolean): UnlockGoal {
  return {
    kind: 'store',
    kicker: affordable ? 'READY TO BUY' : 'SAVE UP',
    name: candidate.name,
    detail: affordable
      ? `${candidate.cost} SCRAP · READY NOW`
      : `${scrap} / ${candidate.cost} SCRAP · ${candidate.cost - scrap} TO GO`,
    progress: percent(scrap, candidate.cost),
    action: 'store',
  };
}

function doneGoal(): UnlockGoal {
  return {
    kind: 'done',
    kicker: 'DONE',
    name: 'EVERYTHING UNLOCKED',
    detail: 'THE LEASE IS YOURS.',
    progress: 100,
    action: null,
  };
}

/**
 * The single "what should I chase next?" answer for the lobby, store, pause and
 * failure report. Pure: reads the passed state and never writes it.
 */
export function nextUnlock(save: ProgressionState, stars: number): UnlockGoal {
  const milestone = LEDGER.find((entry) => entry.stars > stars);
  if (milestone) {
    const remaining = milestone.stars - stars;
    if (remaining === 1 || remaining === 2) return ledgerGoal(milestone, stars);
  }

  const candidates = storeCandidates(save);
  const affordable = cheapest(candidates.filter((candidate) => save.scrap >= candidate.cost));
  if (affordable) return storeGoal(affordable, save.scrap, true);

  if (milestone) return ledgerGoal(milestone, stars);

  const unaffordable = cheapest(candidates.filter((candidate) => save.scrap < candidate.cost));
  if (unaffordable) return storeGoal(unaffordable, save.scrap, false);

  return doneGoal();
}
