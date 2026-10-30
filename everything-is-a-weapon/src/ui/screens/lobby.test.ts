// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest';
import type { Game } from '../../core/Game';
import type { HeroId } from '../../core/Hero';
import { RoomManager } from '../../gameplay/RoomManager';
import { SaveManager } from '../../save/SaveManager';
import { buildMainMenu } from './lobby';

const HERO_CASES = [
  ['tenant', 'tenant'],
  ['flatmate', 'flatmate'],
  ['gran', 'gran'],
  ['kid', 'kid'],
] as const satisfies ReadonlyArray<readonly [HeroId, string]>;

function menuFor(hero: HeroId): HTMLElement {
  const save = new SaveManager();
  save.data.hero = hero;
  const game = {
    save,
    discoveries: { total: 131, count: 0 },
    rooms: new RoomManager(),
    hero,
  } as unknown as Game;
  return buildMainMenu(game, {
    play() {},
    continueRun() {},
    daily() {},
    store() {},
    settings() {},
    hero() {},
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

it.each(HERO_CASES)('shows only the selected %s hero in the main menu', (hero, slug) => {
  const menu = menuFor(hero);
  document.body.append(menu);

  const portraits = [...menu.querySelectorAll<HTMLImageElement>('.b2-lobby__hero')];
  expect(portraits).toHaveLength(1);
  expect(portraits[0]?.getAttribute('src')).toContain(`${slug}.png`);
  expect(menu.querySelector('.b2-lobby__cast')).toBeNull();
  expect(menu.querySelector('img[src*="bonk-cast"]')).toBeNull();
});

it('offers Easy/Normal/Hard on the run-setup sheet and keeps the saved choice', () => {
  const save = new SaveManager();
  save.data.difficulty = 'hard';
  const game = {
    save,
    discoveries: { total: 131, count: 0 },
    rooms: new RoomManager(),
    hero: 'kid',
  } as unknown as Game;
  const menu = buildMainMenu(game, {
    play() {},
    continueRun() {},
    daily() {},
    store() {},
    settings() {},
    hero() {},
  });
  document.body.append(menu);

  const buttons = [...menu.querySelectorAll<HTMLButtonElement>('.b2-lobby__diffbtn')];
  expect(buttons.map((b) => b.textContent)).toEqual(['EASY', 'NORMAL', 'HARD']);
  expect(buttons.filter((b) => b.classList.contains('is-active')).map((b) => b.textContent)).toEqual(['HARD']);

  buttons[0]?.click();
  expect(save.data.difficulty).toBe('easy');
});
