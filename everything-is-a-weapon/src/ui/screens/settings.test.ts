// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { buildSettings } from './settings';

function stub2d(): CanvasRenderingContext2D {
  const ctx: CanvasRenderingContext2D = new Proxy(function noop() {}, {
    get(_target, prop) {
      if (prop === 'canvas') return null;
      if (prop === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
        colorSpace: 'srgb',
      });
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'valueOf' || prop === 'toString') return () => 0;
      return ctx;
    },
    apply: () => ctx,
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return ctx;
}

function fakeCanvas(): HTMLCanvasElement {
  const canvas = {
    width: 1280,
    height: 720,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => {} }),
    getContext: () => stub2d(),
  };
  return canvas as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('has one settings pane and no static shop', () => {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  document.body.append(buildSettings(game, vi.fn()));
  expect([...document.querySelectorAll('.b2-tab')].map((t) => t.textContent)).toEqual(['SETTINGS']);
  expect(document.body.textContent).not.toContain('SOON');
  expect(document.body.textContent).not.toContain('THE STORE IS RESTOCKING');
  expect(document.body.textContent).toContain('ADJUST THE CHAOS');
});
