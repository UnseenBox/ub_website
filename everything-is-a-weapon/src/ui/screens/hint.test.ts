// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { HUD } from './hud';

function fakeCanvas(): HTMLCanvasElement {
  const ctx: CanvasRenderingContext2D = new Proxy(function noop() {}, {
    get(_t, prop) {
      if (prop === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (prop === Symbol.toPrimitive) return () => 0;
      return ctx;
    },
    apply: () => ctx,
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return {
    width: 1280, height: 720, style: {},
    addEventListener: () => {}, removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => {} }),
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

function setup(): { game: Game; hud: HUD; box: () => HTMLElement } {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  const parent = document.createElement('div');
  document.body.append(parent);
  const hud = new HUD(game, parent, () => {});
  game.hud = Object.assign(game.hud, { hint: hud.hint.bind(hud) });
  return { game, hud, box: () => parent.querySelector<HTMLElement>('.b2-hint')! };
}

it('shows one hint, replaces it, and lets it expire; banners stay off', () => {
  const { hud, box } = setup();
  hud.hint('WET + SOCKET', '', 2);
  expect(box().classList.contains('show')).toBe(true);
  expect(box().textContent).toBe('WET + SOCKET');
  hud.hint('BLOCK THE TRACK', 'put something heavy on the rails', 2);
  expect(document.querySelectorAll('.b2-hint')).toHaveLength(1);
  expect(box().textContent).toBe('BLOCK THE TRACK: PUT SOMETHING HEAVY ON THE RAILS');
  hud.frame(1);
  expect(box().classList.contains('show')).toBe(true);
  hud.frame(1.5);
  expect(box().classList.contains('show')).toBe(false);
  hud.banner('BIG', 'card', 2);
  expect(document.querySelector('.hud-banner.show')).toBeNull();
});

it('Game.hint with a key only shows the first time and survives a reload', () => {
  const { game, box } = setup();
  game.hint('BLOCK THE TRACK', 'rule', 2, 'boss:TrainScript');
  expect(box().classList.contains('show')).toBe(true);
  box().classList.remove('show');
  game.hint('BLOCK THE TRACK', 'rule', 2, 'boss:TrainScript');
  expect(box().classList.contains('show')).toBe(false);
  expect(game.save.data.hintsSeen).toEqual(['boss:TrainScript']);
});
