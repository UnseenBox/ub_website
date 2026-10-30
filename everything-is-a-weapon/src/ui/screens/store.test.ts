// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { Game } from '../../core/Game';
import { buildStore } from './store';

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

function store(game: Game, overrides: Partial<Parameters<typeof buildStore>[1]> = {}) {
  return buildStore(game, {
    buyUpgrade: (id) => game.buyUpgrade(id),
    buyAbility: (id) => game.buyAbility(id),
    buyOutfit: (id) => game.buyOutfit(id),
    equipOutfit: (id) => game.equipOutfit(id),
    back: vi.fn(),
    ...overrides,
  });
}

function boot(): Game {
  const game = new Game(fakeCanvas());
  vi.spyOn(game.loop, 'start').mockImplementation(() => {});
  game.start();
  return game;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows the wallet, five upgrade tracks, and the next unlock', () => {
  const game = boot();
  game.save.data.scrap = 300;
  document.body.append(store(game));
  expect(document.querySelectorAll('[data-upgrade]')).toHaveLength(5);
  expect(document.querySelector('.b2-store__wallet')!.textContent).toContain('300');
  expect(document.querySelector('.b2-store__goal')!.textContent).toContain('READY TO BUY');
  expect(document.querySelector('[data-upgrade="door"]')!.textContent).toContain('NEEDS 400 SCRAP');
});

it('buys in place and updates pips, effect, wallet, and goal', () => {
  const game = boot();
  game.save.data.scrap = 1000;
  document.body.append(store(game));
  const card = document.querySelector<HTMLElement>('[data-upgrade="scrap"]')!;
  const button = card.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!;
  button.click();
  expect(game.save.data.upgrades.scrap).toBe(1);
  expect(game.save.data.scrap).toBe(800);
  expect(card.dataset.level).toBe('1');
  expect(card.querySelector('.b2-upgrade__pips')!.textContent).toBe('●○○○');
  expect(card.textContent).toContain('+10% SCRAP FROM INTRUDERS');
  expect(card.textContent).toContain('NEXT: +10% SCRAP');
  expect(document.querySelector('.b2-store__wallet')!.textContent).toContain('800');
});

it('shows MAXED and no buy button at the cap', () => {
  const game = boot();
  game.save.data.scrap = 10000;
  game.save.data.upgrades.door = 2;
  document.body.append(store(game));
  const card = document.querySelector<HTMLElement>('[data-upgrade="door"]')!;
  expect(card.querySelector('.b2-shop-card__buy')).toBeNull();
  expect(card.textContent).toContain('MAXED');
  expect(card.textContent).toContain('7 MAX HEARTS');
});

it('switches to the powers tab and buys an ability', () => {
  const game = boot();
  game.save.data.scrap = 500;
  document.body.append(store(game));
  const powers = [...document.querySelectorAll<HTMLButtonElement>('.b2-tab')]
    .find((tab) => tab.textContent === 'POWERS')!;
  powers.click();
  expect(document.querySelectorAll('.b2-store__powers .b2-shop-card')).toHaveLength(3);
  const card = [...document.querySelectorAll<HTMLElement>('.b2-store__powers .b2-shop-card')]
    .find((node) => node.textContent!.includes('BIG RED BUTTON'))!;
  card.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!.click();
  expect(game.save.data.abilities).toContain('blast');
  expect(game.save.data.scrap).toBe(350);
});

it('warns that upgrades apply when the run continues', () => {
  const game = boot();
  game.save.data.runActive = true;
  document.body.append(store(game));
  expect(document.body.textContent).toContain('YOUR RUN IS SAVED. UPGRADES APPLY WHEN YOU CONTINUE.');
});
