import { describe, expect, it } from 'vitest';
import {
  claimLedger,
  descendStart,
  ledgerBonus,
  ledgerCooldownMultiplier,
  ledgerScoreMultiplier,
  ledgerScrapMultiplier,
  pendingLedger,
  startingEdgeRarity,
  type LedgerState,
} from './StarLedger';

function ledger(overrides: Partial<LedgerState> = {}): LedgerState {
  return {
    roomStars: {},
    starRewardsClaimed: [],
    scrap: 0,
    ...overrides,
  };
}

function withStars(stars: number): Record<string, number> {
  const rooms: Record<string, number> = {};
  let left = stars;
  for (let i = 0; left > 0; i++) {
    const take = Math.min(3, left);
    rooms[`room_${i}`] = take;
    left -= take;
  }
  return rooms;
}

describe('StarLedger', () => {
  it('claims the 3-star stipend once', () => {
    const state = ledger({ roomStars: withStars(3) });
    const first = claimLedger(state);
    expect(first.map((claim) => claim.id)).toEqual(['scrap_3']);
    expect(state.scrap).toBe(100);
    expect(claimLedger(state)).toEqual([]);
    expect(state.scrap).toBe(100);
  });

  it('does not claim before the threshold', () => {
    const state = ledger({ roomStars: withStars(2) });
    expect(pendingLedger(state)).toEqual([]);
    expect(claimLedger(state)).toEqual([]);
    expect(ledgerBonus(state, 'scrap_3')).toBe(false);
  });

  it('claims all crossed milestones in order and pays their scrap', () => {
    const state = ledger({ roomStars: withStars(12) });
    const claims = claimLedger(state);
    expect(claims.map((claim) => claim.id)).toEqual(['scrap_3', 'score_6', 'edge_9', 'scrap_12']);
    expect(state.scrap).toBe(250);
    expect(pendingLedger(state)).toEqual([]);
  });

  it('only applies score, scrap, and cooldown badges once claimed', () => {
    const state = ledger({ roomStars: withStars(24) });
    expect(ledgerScoreMultiplier(state)).toBe(1);
    expect(ledgerScrapMultiplier(state)).toBe(1);
    expect(ledgerCooldownMultiplier(state)).toBe(1);
    claimLedger(state);
    expect(ledgerScoreMultiplier(state)).toBe(1.15);
    expect(ledgerScrapMultiplier(state)).toBe(1.2);
    expect(ledgerCooldownMultiplier(state)).toBe(0.85);
  });

  it('starts a run with a common Edge at 9 stars and a rare Edge at 18', () => {
    const common = ledger({ roomStars: withStars(9) });
    claimLedger(common);
    expect(startingEdgeRarity(common)).toBe('common');

    const rare = ledger({ roomStars: withStars(18) });
    claimLedger(rare);
    expect(startingEdgeRarity(rare)).toBe('rare');
  });

  it('descendStart uses the first Depths floor, or floor 19 with the Master Key', () => {
    const state = ledger({ roomStars: withStars(27) });
    expect(descendStart(state, 9)).toBe(9);
    claimLedger(state);
    expect(descendStart(state, 9)).toBe(18);
  });

  it('Master Key never moves a deeper run backward', () => {
    const state = ledger({ starRewardsClaimed: ['master_key'] });
    expect(descendStart(state, 20)).toBe(20);
  });

  it('clamps each room to three stars when totalling the ledger', () => {
    const state = ledger({ roomStars: { a: 9, b: -2 } });
    expect(claimLedger(state).map((claim) => claim.id)).toEqual(['scrap_3']);
  });
});
