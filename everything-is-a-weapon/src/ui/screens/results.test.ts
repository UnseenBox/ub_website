// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import type { RoomSummary } from '../../core/Game';
import { EDGE_BY_ID, type EdgeId } from '../../gameplay/Edges';
import { buildResults } from './results';

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

function actions() {
  return {
    next: vi.fn(),
    retry: vi.fn(),
    continueWithReward: vi.fn(),
    home: vi.fn(),
    chooseEdge: vi.fn(() => ''),
    stamped: vi.fn(),
  };
}

const edge = (id: EdgeId) => EDGE_BY_ID[id];
const offer = [edge('heavy_hands'), edge('quick_feet'), edge('scrap_luck')];
const draft = summary({
  offer,
  run: { floor: 3, nextFloor: 4, streak: 2, score: 4200, types: 2, stacks: 3, boosts: ['heavy_hands'], ended: false },
  nextRoom: { number: 4, name: 'THE BATHROOM', boss: false },
  nextEdge: { number: 5, boss: false },
});

beforeEach(() => {
  document.body.innerHTML = '';
  window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;
});

it('final victory is simple: replay and home, no next room or cards', () => {
  const screen = buildResults(summary({ finale: true }), actions());
  document.body.append(screen);

  expect(screen.querySelector('.b2-panel__title')?.textContent).toBe('FINAL VICTORY');
  expect(screen.querySelector('button.b2-edge')).toBeNull();
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

it('renders the draft, disables the primary, and focuses the first card', () => {
  document.body.append(buildResults(draft, actions()));
  const cards = [...document.querySelectorAll<HTMLButtonElement>('button.b2-edge')];
  expect(cards).toHaveLength(3);
  expect(cards[0]!.dataset.autofocus).toBe('true');
  const primary = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  expect(primary.disabled).toBe(true);
  expect(primary.textContent).toContain('PICK AN EDGE');
});

it('takes an Edge, stamps it, and enables NEXT ROOM', () => {
  const acts = actions();
  document.body.append(buildResults(draft, acts));
  document.querySelector<HTMLButtonElement>('button.b2-edge')!.click();
  expect(acts.chooseEdge).toHaveBeenCalledWith('heavy_hands');
  const primary = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  expect(primary.disabled).toBe(false);
  expect(primary.textContent).toContain('NEXT ROOM');
  expect(document.querySelector('.b2-edge.is-taken')).toBeTruthy();
  expect(document.querySelector('[aria-live="polite"]')!.textContent).toContain('NEXT ROOM UNLOCKED');
});

it('recovers from an expired offer without blocking NEXT ROOM', () => {
  const acts = actions();
  acts.chooseEdge.mockReturnValue('NO EDGE OFFER');
  document.body.append(buildResults(draft, acts));
  document.querySelector<HTMLButtonElement>('button.b2-edge')!.click();
  expect(document.querySelector('.b2-report__draftstatus')!.textContent).toContain('EDGE OFFER EXPIRED');
  const primary = document.querySelector<HTMLButtonElement>('.b2-results__action.primary')!;
  expect(primary.disabled).toBe(false);
  expect(primary.textContent).toContain('NEXT ROOM');
  expect(document.querySelector('.b2-edge.is-taken')).toBeNull();
});

it('requires a second tap to skip a pending Edge', () => {
  const acts = actions();
  document.body.append(buildResults(draft, acts));
  const home = [...document.querySelectorAll<HTMLButtonElement>('.b2-results__action')]
    .find((b) => b.textContent?.includes('HOME'))!;
  home.click();
  expect(acts.home).not.toHaveBeenCalled();
  expect(home.textContent).toContain('TAP AGAIN TO SKIP');
  home.click();
  expect(acts.home).toHaveBeenCalledOnce();
});

it('drops the skip confirmation after an Edge is taken', () => {
  const acts = actions();
  document.body.append(buildResults(draft, acts));
  document.querySelector<HTMLButtonElement>('button.b2-edge')!.click();
  const home = [...document.querySelectorAll<HTMLButtonElement>('.b2-results__action')]
    .find((b) => b.textContent?.includes('HOME'))!;
  expect(home.textContent).toContain('HOME');
  expect(home.textContent).not.toContain('SKIP');
  home.click();
  expect(acts.home).toHaveBeenCalledOnce();
});

it('arms REPLAY ROOM when a live run would be lost', () => {
  const acts = actions();
  document.body.append(buildResults(summary({
    offer: [],
    run: { floor: 8, nextFloor: 9, streak: 1, score: 3000, types: 1, stacks: 2, boosts: ['heavy_hands'], ended: false },
    nextRoom: { number: 9, name: 'THE KITCHEN', boss: false },
  }), acts));
  const replay = [...document.querySelectorAll<HTMLButtonElement>('.b2-results__action')]
    .find((b) => b.textContent?.includes('REPLAY'))!;
  replay.click();
  expect(acts.retry).not.toHaveBeenCalled();
  expect(replay.textContent).toContain('TAP AGAIN · NEW RUN');
  replay.click();
  expect(acts.retry).toHaveBeenCalledOnce();
});

it('shows the next Edge line on a non-draft victory', () => {
  document.body.append(buildResults(summary({
    offer: [],
    nextRoom: { number: 11, name: 'THE HALLWAY', boss: false },
    nextEdge: { number: 11, boss: false },
  }), actions()));
  expect(document.querySelectorAll('button.b2-edge')).toHaveLength(0);
  expect(document.querySelector('.b2-report__nextedge')!.textContent).toContain('NEXT EDGE · ROOM 11');
});

it('shows BUILD MAXED when no draft remains', () => {
  document.body.append(buildResults(summary({ offer: [], nextEdge: null, buildMaxed: true }), actions()));
  expect(document.body.textContent).toContain('BUILD MAXED');
});

it('reports failure with no salvage, kept Edges and the next goal', () => {
  document.body.append(buildResults(summary({
    cleared: false, score: 900, offer: [], noSalvage: true,
    run: { floor: 12, nextFloor: null, streak: 0, score: 5000, types: 2, stacks: 5, boosts: ['quick_feet', 'quick_feet', 'heavy_hands'], ended: false },
    nextGoal: { kind: 'ledger', kicker: 'NEXT STAR', name: 'SCRAP STIPEND', detail: '2 STARS TO GO · +100 SCRAP', progress: 33, action: 'ledger' },
  }), actions()));
  expect(document.body.textContent).toContain('NO SALVAGE');
  expect(document.body.textContent).toContain('EDGES KEPT · STREAK RESET');
  expect(document.body.textContent).toContain('NEXT STAR · SCRAP STIPEND');
  expect(document.body.textContent).toContain('RUN SCORE');
});

it('keeps a daily failure to practice notes without the campaign run report', () => {
  document.body.append(buildResults(summary({
    cleared: false, daily: true, score: 900, noSalvage: true,
    run: { floor: 7, nextFloor: null, streak: 3, score: 5000, types: 2, stacks: 3, boosts: [], ended: false },
  }), actions()));
  expect(document.body.textContent).toContain('NO SALVAGE');
  expect(document.body.textContent).toContain('PRACTICE · NO REWARD');
  expect(document.querySelector('.b2-report__runreport')).toBeNull();
  expect(document.body.textContent).not.toContain('RUN · FLOOR');
});

it('puts a loud STAR LEDGER strip before the notes', () => {
  document.body.append(buildResults(summary({
    ledgerClaims: [{ id: 'scrap_3', stars: 3, name: 'SCRAP STIPEND', reward: '+100 scrap', scrap: 100 }],
  }), actions()));
  const strip = document.querySelector('.b2-report__ledger')!;
  expect(strip.textContent).toContain('STAR LEDGER');
  expect(strip.textContent).toContain('+100 scrap');
});

it('uses DONE for a daily and shows practice on a replay', () => {
  document.body.append(buildResults(summary({
    daily: true, dailyReplay: true, dailyStreak: 3, dailyBonus: 0,
  }), actions()));
  expect(document.body.textContent).toContain('PRACTICE · NO REWARD');
  expect(document.querySelector('.b2-results__action.primary')!.textContent).toContain('DONE');
});
