// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import type { Game } from '../../core/Game';
import { buildCharactersPane } from './characters';

it('shows each hero once, using the full hero-and-pet illustration', () => {
  const pane = buildCharactersPane({ hero: 'tenant' } as Game);
  const cards = [...pane.querySelectorAll<HTMLButtonElement>('.b2-hero')];
  const accents = ['violet', 'teal', 'rose', 'lime'];

  expect(cards).toHaveLength(4);
  cards.forEach((card, index) => {
    expect(card.querySelector('.b2-hero__portrait')?.getAttribute('src')).toContain(
      `character-${accents[index]}`,
    );
    expect(card.querySelectorAll('img')).toHaveLength(1);
    expect(card.querySelector('.b2-hero__pet')).toBeNull();
  });
});
