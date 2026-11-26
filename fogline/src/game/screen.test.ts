import { afterEach, describe, expect, it } from 'vitest';
import { MAX_SCREEN, SCREEN, designPoint, edgeShift, fitScreen } from './screen';
import { STICK, TOUCH_LAYOUT, isAimTouch, isFireTouch, stickHome, touchButtonAt, touchLayout } from './touchControls';

/** How much of a vw × vh window the fitted canvas covers when scaled to fit inside it. */
function coverage(vw: number, vh: number, inset = 0): number {
  const f = fitScreen(vw, vh, inset);
  const scale = Math.min(vw / f.width, vh / f.height);
  return (f.width * scale * f.height * scale) / (vw * vh);
}

describe('fitting the game to the screen', () => {
  it('leaves a 16:9 window exactly as designed', () => {
    expect(fitScreen(1280, 720)).toEqual({ width: 1280, height: 720, mx: 0, my: 0, safe: 0 });
    expect(fitScreen(1920, 1080).width).toBe(1280);
  });

  it('fills phones held sideways, browser bars or not', () => {
    for (const [w, h] of [[844, 390], [740, 340], [932, 430], [667, 331], [915, 412], [800, 360]]) {
      expect(coverage(w, h), `${w}x${h}`).toBeGreaterThan(0.99);
    }
  });

  it('fills tablets and the 16:10 box the website embeds it in', () => {
    for (const [w, h] of [[1180, 820], [1024, 768], [960, 600]]) expect(coverage(w, h), `${w}x${h}`).toBeGreaterThan(0.99);
  });

  it('never shrinks the 1280×720 design area, and stops growing at the limits', () => {
    const wide = fitScreen(2000, 500);
    expect(wide).toMatchObject({ width: MAX_SCREEN.width, height: 720 });
    const tall = fitScreen(500, 900);
    expect(tall).toMatchObject({ width: 1280, height: MAX_SCREEN.height });
  });

  it('keeps the design area clear of a notch', () => {
    // 700 × 360 with 47 px insets: the design area must fit between them.
    const f = fitScreen(700, 360, 47);
    const scale = Math.min(700 / f.width, 360 / f.height);
    expect(1280 * scale).toBeLessThanOrEqual(700 - 94 + 0.5);
    expect(f.safe * scale).toBeCloseTo(47, 0);
  });

  it('falls back to the design size when the window has no size yet', () => {
    expect(fitScreen(0, 0)).toMatchObject({ width: 1280, height: 720 });
  });
});

describe('touch controls on a wide screen', () => {
  const phone = fitScreen(844, 390);
  afterEach(() => Object.assign(SCREEN, fitScreen(1280, 720)));

  it('moves the buttons out to the screen edges', () => {
    Object.assign(SCREEN, phone);
    const L = touchLayout();
    expect(L.fire.x).toBe(TOUCH_LAYOUT.fire.x + edgeShift());
    expect(L.pause.x).toBe(TOUCH_LAYOUT.pause.x - edgeShift());
    expect(L.deploy.x).toBe(TOUCH_LAYOUT.deploy.x);
    expect(touchButtonAt(L.fire.x, L.fire.y, false)).toBe('fire');
    expect(touchButtonAt(L.pause.x, L.pause.y, false)).toBe('pause');
  });

  it('lets the aim thumb use the extra space on the left', () => {
    Object.assign(SCREEN, phone);
    expect(isAimTouch(-SCREEN.mx + 5, 300)).toBe(true);
    expect(isAimTouch(-SCREEN.mx - 5, 300)).toBe(false);
  });

  it('rests the aim stick by the left edge and fires out to the right edge', () => {
    Object.assign(SCREEN, phone);
    expect(stickHome().x).toBe(STICK.home.x - edgeShift());
    expect(isFireTouch(1280 + SCREEN.mx - 5, 300)).toBe(true);
    expect(isFireTouch(1280 + SCREEN.mx + 5, 300)).toBe(false);
  });

  it('turns a canvas point into a point in the design area', () => {
    Object.assign(SCREEN, phone);
    expect(designPoint({ x: phone.mx + 640, y: 360 })).toEqual({ x: 640, y: 360 });
  });
});
