// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import type { Game } from '../../core/Game';
import { buildCharactersPane } from './characters';

it('shows each hero once, using the full hero-and-pet illustration', () => {
  const pane = buildCharactersPane({
    hero: 'tenant',
    isHeroUnlocked: (id: string) => id === 'tenant',
    heroProgress: () => ({ deepest: 1, endlessBestFloor: 0, discoveries: 4 }),
  } as unknown as Game);
  const cards = [...pane.querySelectorAll<HTMLButtonElement>('.b2-hero')];
  const portraits = ['tenant.png', 'flatmate.png', 'gran.png', 'kid.png'];
  const accents = ['teal', 'violet', 'rose', 'lime'];

  expect(cards).toHaveLength(4);
  cards.forEach((card, index) => {
    expect(card.querySelector('.b2-hero__portrait')?.getAttribute('src')).toContain(
      portraits[index],
    );
    expect(card.dataset.accent).toBe(accents[index]);
    expect(card.querySelectorAll('img')).toHaveLength(1);
    expect(card.querySelector('.b2-hero__pet')).toBeNull();
  });
});

it('locks the other heroes with their goal and progress, and leaves them unpickable', () => {
  const picked: string[] = [];
  const pane = buildCharactersPane(
    {
      hero: 'tenant',
      isHeroUnlocked: (id: string) => id === 'tenant',
      heroProgress: () => ({ deepest: 1, endlessBestFloor: 0, discoveries: 4 }),
    } as unknown as Game,
    { onPick: (id) => picked.push(id) },
  );
  const cards = [...pane.querySelectorAll<HTMLButtonElement>('.b2-hero')];
  expect(cards[0]!.classList.contains('is-locked')).toBe(false);
  expect(cards.slice(1).every((card) => card.classList.contains('is-locked'))).toBe(true);
  expect(cards[1]!.textContent).toContain('CLEAR 3 ROOMS');
  expect(cards[1]!.textContent).toContain('1/3');
  cards[1]!.click();
  expect(picked).toEqual([]);
});
