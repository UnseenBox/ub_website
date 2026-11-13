import { expect, it } from 'vitest';
import { nextUnlock, type ProgressionState } from './Progression';

function state(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return { scrap: 0, abilities: [], upgrades: {}, ...overrides };
}

it('puts a Ledger milestone first when fewer than three stars remain', () => {
  const goal = nextUnlock(state({ scrap: 10000 }), 1);
  expect(goal).toMatchObject({
    kind: 'ledger',
    kicker: 'NEXT STAR',
    name: 'COIN STIPEND',
    detail: '2 STARS TO GO · +100 COINS',
    progress: 33,
    action: 'ledger',
  });
});

it('does not treat exactly three remaining stars as close', () => {
  const goal = nextUnlock(state({ scrap: 500 }), 0);
  expect(goal.kind).toBe('store');
  expect(goal.kicker).toBe('READY TO BUY');
  // HEAVY ARM (100) is the cheapest thing in the store
  expect(goal.name).toBe('HEAVY ARM');
  expect(goal.detail).toBe('100 COINS · READY NOW');
});

it('picks the cheapest affordable store item', () => {
  const goal = nextUnlock(state({ scrap: 130, abilities: ['overdrive'], upgrades: { damage: 1 } }), 0);
  expect(goal).toMatchObject({
    kind: 'store',
    kicker: 'READY TO BUY',
    name: 'DEEP FREEZE',
    detail: '120 COINS · READY NOW',
    progress: 100,
    action: 'store',
  });
});

it('falls back to the next star when nothing is affordable', () => {
  const goal = nextUnlock(state({ scrap: 10 }), 3);
  expect(goal).toMatchObject({
    kind: 'ledger',
    kicker: 'NEXT STAR',
    name: 'CROWD FAVOURITE',
    detail: '3 STARS TO GO · +15% SCORE',
    action: 'ledger',
  });
});

it('shows a save-up store goal when the star track is complete', () => {
  const goal = nextUnlock(state({ scrap: 10 }), 27);
  expect(goal).toMatchObject({
    kind: 'store',
    kicker: 'SAVE UP',
    name: 'HEAVY ARM',
    detail: '10 / 100 COINS · 90 TO GO',
    progress: 10,
    action: 'store',
  });
});

it('reports done only when every power, upgrade and star is complete', () => {
  const maxed = state({
    scrap: 0,
    abilities: ['blast', 'overdrive', 'freeze'],
    upgrades: { door: 5, damage: 8, speed: 5, power: 5, scrap: 4, cooldown: 4, score: 4, pet: 4 },
  });
  expect(nextUnlock(maxed, 27)).toEqual({
    kind: 'done',
    kicker: 'DONE',
    name: 'EVERYTHING UNLOCKED',
    detail: 'THE HOUSE IS YOURS.',
    progress: 100,
    action: null,
  });
});
