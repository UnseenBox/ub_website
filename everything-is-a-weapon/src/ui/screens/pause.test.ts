// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../core/Game';
import { buildPauseMenu, type PauseActions } from './pause';

function fakeGame(runActive = false): Game {
  return {
    save: { data: { scrap: 45, runActive } },
    abilities: { owned: () => false },
  } as unknown as Game;
}

function actions(): PauseActions {
  return {
    resume: vi.fn(),
    restart: vi.fn(),
    settings: vi.fn(),
    home: vi.fn(),
    buyAbility: vi.fn(() => ''),
    lesson: vi.fn(),
  };
}

describe('the pause menu', () => {
  it('opens with four actions and everything else folded away', () => {
    const screen = buildPauseMenu(false, fakeGame(), actions());
    expect(screen.querySelector('.b2-panel__title')?.textContent).toBe('PAUSED.');

    const primary = [...screen.querySelectorAll('.b2-pause__actions .b2-btn')].map((b) => b.textContent);
    expect(primary).toHaveLength(4);
    expect(primary[0]).toContain('KEEP GOING');

    const folds = screen.querySelectorAll('details.b2-pause__fold');
    expect(folds).toHaveLength(2);
    for (const fold of folds) expect((fold as HTMLDetailsElement).open).toBe(false);
  });

  it('keeps powers, controls and tutorial replay one tap away', () => {
    const screen = buildPauseMenu(false, fakeGame(true), actions());
    expect(screen.querySelectorAll('.b2-pause__fold .b2-shop-card')).toHaveLength(3);
    expect(screen.querySelectorAll('.b2-pause__control')).toHaveLength(8);
    expect(screen.querySelectorAll('.b2-pause__lessons .b2-btn')).toHaveLength(7);
    expect(screen.textContent).toContain('current Edges and run score are lost');
  });

  it('resumes from the big button', () => {
    const handlers = actions();
    const screen = buildPauseMenu(false, fakeGame(), handlers);
    (screen.querySelector('.b2-pause__keep') as HTMLButtonElement).click();
    expect(handlers.resume).toHaveBeenCalledOnce();
  });
});
