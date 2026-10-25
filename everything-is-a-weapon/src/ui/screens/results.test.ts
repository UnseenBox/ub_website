// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import type { RoomSummary } from '../../core/Game';
import { buildResults, type ResultsActions } from './results';

function summary(overrides: Partial<RoomSummary>): RoomSummary {
  return {
    cleared: true,
    roomNumber: 50,
    roomName: 'THE LAST DOOR',
    daily: false,
    score: 12345,
    highScore: 12345,
    isHighScore: false,
    bestChain: 4,
    objectsUsed: 9,
    newDiscoveries: 0,
    challengeText: null,
    challengePassed: false,
    challengeBonus: 0,
    firstClearBonus: 100,
    roomBest: 0,
    canContinue: false,
    stars: 3,
    isNewBestStars: true,
    contractsNew: [],
    dailyBonus: 0,
    actName: 'ACT V · THE FINAL NOTICE',
    objective: 'evict the king',
    story: 'the last door',
    finale: false,
    runEnded: false,
    ledgerClaims: [],
    roomScore: 2340,
    isNewRoomBest: false,
    offer: [],
    nextRoom: null,
    nextEdge: null,
    nextGoal: { kind: 'store', kicker: 'READY TO BUY', name: 'EVERYTHING UNLOCKED', detail: 'THE LEASE IS YOURS.', progress: 100, action: null },
    ledgerNext: null,
    ledgerStars: 12,
    totalStars: 12,
    dailyStreak: 0,
    dailyReplay: false,
    dailyRareEdgeGranted: false,
    noSalvage: false,
    buildMaxed: false,
    run: { floor: 50, nextFloor: null, streak: 12, score: 12345, types: 3, stacks: 5, boosts: [], ended: false },
    ...overrides,
  };
}

function actions(): ResultsActions {
  return {
    next: vi.fn(),
    retry: vi.fn(),
    continueWithReward: vi.fn(),
    home: vi.fn(),
    stamped: vi.fn(),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
});

it('final victory is simple: replay and home, no next room or cards', () => {
  const screen = buildResults(summary({ finale: true }), actions());
  document.body.append(screen);

  expect(screen.querySelector('.b2-panel__title')?.textContent).toBe('FINAL VICTORY');
  expect(screen.querySelector('button.edge-card')).toBeNull();
  expect(screen.querySelector('.b2-report__offer')).toBeNull();
  expect(screen.querySelector('.b2-report__next')).toBeNull();
  const labels = [...screen.querySelectorAll<HTMLElement>('.b2-results__actionlabel')]
    .map((node) => node.textContent);
  expect(labels).toEqual(['REPLAY ROOM', 'HOME']);
});

it('a normal clear exposes exactly NEXT ROOM, REPLAY ROOM, HOME', () => {
  const screen = buildResults(summary({}), actions());
  document.body.append(screen);

  const labels = [...screen.querySelectorAll<HTMLElement>('.b2-results__actionlabel')]
    .map((node) => node.textContent);
  expect(labels).toEqual(['NEXT ROOM', 'REPLAY ROOM', 'HOME']);
});
