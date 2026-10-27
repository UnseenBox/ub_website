// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../core/Game';
import { buildRoomsPane } from './rooms';

const ROOMS = 50;

function fakeGame(): Game {
  const definition = (index: number) => ({
    id: `room-${index + 1}`,
    name: `room ${index + 1}`,
    boss: index === 1 ? 'headliner' : undefined,
  });
  return {
    save: {
      data: {
        unlockedRoom: 4,
        roomStars: { 'room-1': 3, 'room-2': 1 },
        roomBests: { 'room-1': { score: 900 } },
        deepest: 5,
      },
    },
    rooms: { roomCount: ROOMS, definition },
  } as unknown as Game;
}

describe('the room selector', () => {
  it('draws one compact tile per room and keeps locked ones inert', () => {
    const screen = buildRoomsPane(fakeGame());
    expect(screen.root.querySelector('.b2-rooms__title')?.textContent).toBe('THE FLOOR PLAN');
    expect(screen.root.querySelectorAll('.b2-roomtile')).toHaveLength(ROOMS);
    expect(screen.root.querySelectorAll('.b2-keycard')).toHaveLength(0);
    expect(screen.root.querySelectorAll('.b2-roomgrid__act')).toHaveLength(5);
    expect(screen.root.querySelectorAll('.b2-roomtile.is-locked')).toHaveLength(ROOMS - 5);
    expect(screen.root.querySelectorAll('.b2-roomtile.is-selected')).toHaveLength(1);

    const onSelect = vi.fn();
    const pane = buildRoomsPane(fakeGame(), { initial: 0, onSelect });
    onSelect.mockClear();
    const locked = pane.root.querySelector<HTMLButtonElement>('[data-index="9"]')!;
    locked.click();
    expect(onSelect).not.toHaveBeenCalled();

    const open = pane.root.querySelector<HTMLButtonElement>('[data-index="3"]')!;
    open.click();
    expect(pane.selected()).toBe(3);
    expect(pane.root.querySelector('.b2-rooms__pick')?.textContent).toBe('ROOM 4 · room 4');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ index: 3, shortLabel: 'ROOM 4', name: 'room 4' }),
    );
  });

  it('marks bosses and confirms the pick', () => {
    const onEnter = vi.fn();
    const pane = buildRoomsPane(fakeGame(), { initial: 2, onEnter });
    expect(pane.root.querySelector('.b2-roomtile.is-boss')?.getAttribute('data-index')).toBe('1');
    expect(pane.root.textContent).toContain('ROOM 3 · room 3');

    (pane.root.querySelector('.b2-rooms__enter') as HTMLButtonElement).click();
    expect(onEnter).toHaveBeenCalledWith(
      expect.objectContaining({ index: 2, shortLabel: 'ROOM 3' }),
    );
  });
});
