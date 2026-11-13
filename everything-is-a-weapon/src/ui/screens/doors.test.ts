// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import type { Door } from '../../gameplay/NightShift';
import { buildDoors } from './doors';

function door(index: number, overrides: Partial<Door> = {}): Door {
  return {
    index,
    number: index + 1,
    name: `ROOM ${index + 1}`,
    actName: 'ACT I · EVICTION NOTICE',
    actTagline: 'they came with boxes',
    reward: { kind: 'scrap', label: '+50 SCRAP', detail: 'straight to the purse', scrap: 50 },
    risk: { label: 'BOSS', detail: 'Chairman is waiting' },
    ...overrides,
  };
}

function actions() {
  return { pick: vi.fn(), home: vi.fn() };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

it('shows three doors with the room, the reward and the honest risk', () => {
  const rewards = [
    door(1, { reward: { kind: 'scrap', label: '+50 SCRAP', detail: 'straight to the purse', scrap: 50 } }),
    door(4, {
      name: 'GREASE TRAP',
      reward: { kind: 'armor', label: '+1 BUBBLE WRAP', detail: 'start the next room armoured' },
    }),
    door(6, {
      name: 'SHOWROOM',
      reward: { kind: 'edge', label: 'PET FRENZY', detail: 'your pet hits 50% harder', edge: 'cat_frenzy' },
      risk: { label: 'HAZARD', detail: 'oil + sparks' },
    }),
  ];
  const acts = actions();
  const screen = buildDoors(rewards, 2, 9, acts);
  document.body.append(screen);

  expect(screen.querySelector('.b2-doors__kicker')?.textContent).toBe('NIGHT SHIFT · CHOICE 2 OF 9');
  expect(screen.querySelector('.b2-doors__title')?.textContent).toBe('PICK A DOOR.');
  expect(screen.querySelector('.b2-doors__grid')?.className).toContain('b2-doors__grid--3');

  const cards = [...screen.querySelectorAll<HTMLButtonElement>('.b2-door')];
  expect(cards).toHaveLength(3);
  expect(cards.map((card) => card.dataset.index)).toEqual(['1', '4', '6']);
  expect(cards[1]?.textContent).toContain('GREASE TRAP');
  expect(cards[1]?.textContent).toContain('+1 BUBBLE WRAP');
  expect(cards[1]?.textContent).toContain('RISK · BOSS');
  expect(cards[2]?.textContent).toContain('PET FRENZY');
  expect(cards[2]?.textContent).toContain('oil + sparks');
  expect(cards[0]?.getAttribute('aria-label')).toBe(
    'Room 2, ROOM 2. Reward: +50 SCRAP. Risk: BOSS, Chairman is waiting.',
  );

  cards[2]?.click();
  expect(acts.pick).toHaveBeenCalledWith(6);

  const home = screen.querySelector<HTMLButtonElement>('.b2-doors__home');
  expect(home?.textContent).toBe('BACK TO THE LOBBY');
  home?.click();
  expect(acts.home).toHaveBeenCalledOnce();
});

it('turns the last choice into one door and names the king behind it', () => {
  const acts = actions();
  const finale = door(49, {
    name: 'THE LAST DOOR',
    reward: { kind: 'scrap', label: 'THE STUDY', detail: 'the last door. the king is behind it.', scrap: 0 },
    risk: { label: 'BOSS', detail: 'the King of Cardboard' },
  });
  const screen = buildDoors([finale], 9, 9, acts);
  document.body.append(screen);

  expect(screen.querySelector('.b2-doors__kicker')?.textContent).toBe('NIGHT SHIFT · THE LAST DOOR');
  expect(screen.querySelector('.b2-doors__title')?.textContent).toBe('ONE DOOR LEFT.');
  expect(screen.querySelector('.b2-doors__sub')?.textContent).toBe('THE KING OF CARDBOARD IS BEHIND IT.');
  expect(screen.querySelector('.b2-doors__grid')?.className).toContain('b2-doors__grid--1');
  const card = screen.querySelector<HTMLButtonElement>('.b2-door');
  expect(card?.textContent).toContain('THE STUDY');
  card?.click();
  expect(acts.pick).toHaveBeenCalledWith(49);
});

it('centres a two-door choice instead of leaving a gap', () => {
  const screen = buildDoors([door(2), door(5)], 7, 9, actions());
  document.body.append(screen);
  expect(screen.querySelector('.b2-doors__grid')?.className).toContain('b2-doors__grid--2');
  expect(screen.querySelector('.b2-doors__title')?.textContent).toBe('PICK A DOOR.');
});
