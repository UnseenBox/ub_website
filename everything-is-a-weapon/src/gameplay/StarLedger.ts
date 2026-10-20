import { totalStars } from './Campaign';
import type { EdgeRarity } from './Edges';

export interface LedgerState {
  roomStars: Record<string, number>;
  starRewardsClaimed: string[];
  scrap: number;
}

export interface LedgerMilestone {
  id: string;
  stars: number;
  name: string;
  reward: string;
  scrap: number;
}

/** Nine permanent rewards, one every three stars. Scrap milestones all stack. */
export const LEDGER: readonly LedgerMilestone[] = [
  { id: 'scrap_3', stars: 3, name: 'SCRAP STIPEND', reward: '+100 scrap', scrap: 100 },
  { id: 'score_6', stars: 6, name: 'CROWD FAVOURITE', reward: '+15% score', scrap: 0 },
  { id: 'edge_9', stars: 9, name: 'HEAD START', reward: 'start each run with a common Edge', scrap: 0 },
  { id: 'scrap_12', stars: 12, name: 'SCRAP STIPEND II', reward: '+150 scrap', scrap: 150 },
  { id: 'scrap_15', stars: 15, name: 'SALVAGE RIGHTS', reward: '+20% scrap', scrap: 0 },
  { id: 'edge_18', stars: 18, name: 'HEAD START II', reward: 'start each run with a rare Edge', scrap: 0 },
  { id: 'scrap_21', stars: 21, name: 'SCRAP STIPEND III', reward: '+200 scrap', scrap: 200 },
  { id: 'cooldown_24', stars: 24, name: 'QUICK HANDS', reward: '-15% ability cooldowns', scrap: 0 },
  { id: 'master_key', stars: 27, name: 'MASTER KEY', reward: 'DESCEND begins at Depths depth 10 (floor 19)', scrap: 0 },
];

export function ledgerClaimed(state: LedgerState, id: string): boolean {
  return state.starRewardsClaimed.includes(id);
}

export function ledgerBonus(state: LedgerState, id: string): boolean {
  return ledgerClaimed(state, id);
}

export function pendingLedger(state: LedgerState): LedgerMilestone[] {
  const stars = totalStars(state.roomStars);
  return LEDGER.filter((milestone) => stars >= milestone.stars && !ledgerClaimed(state, milestone.id));
}

/** Claims every crossed milestone in threshold order. Safe to call after every clear. */
export function claimLedger(state: LedgerState): LedgerMilestone[] {
  const claims = pendingLedger(state);
  for (const claim of claims) {
    state.starRewardsClaimed.push(claim.id);
    state.scrap += claim.scrap;
  }
  return claims;
}

export function ledgerScoreMultiplier(state: LedgerState): number {
  return ledgerBonus(state, 'score_6') ? 1.15 : 1;
}

export function ledgerScrapMultiplier(state: LedgerState): number {
  return ledgerBonus(state, 'scrap_15') ? 1.2 : 1;
}

export function ledgerCooldownMultiplier(state: LedgerState): number {
  return ledgerBonus(state, 'cooldown_24') ? 0.85 : 1;
}

export function startingEdgeRarity(state: LedgerState): EdgeRarity | null {
  if (ledgerBonus(state, 'edge_18')) return 'rare';
  if (ledgerBonus(state, 'edge_9')) return 'common';
  return null;
}

/** 0-based first floor for DESCEND. Master Key opens floor 19 without skipping a deeper run. */
export function descendStart(state: LedgerState, deepest: number): number {
  const base = Math.max(9, deepest);
  return ledgerBonus(state, 'master_key') ? Math.max(18, base) : base;
}
