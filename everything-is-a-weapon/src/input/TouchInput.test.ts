// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RawInput } from './InputManager';
import { TouchInput } from './TouchInput';

let now = 0;
let target: HTMLElement;
let touch: TouchInput;
let raw: RawInput;

function pointer(type: string, x: number, y: number, on: EventTarget = target): void {
  const event = new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true });
  on.dispatchEvent(event);
}

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  document.body.className = '';
  document.body.innerHTML = '<div id="wrap"><div id="pad"></div></div>';
  target = document.getElementById('pad')!;
  // the right side of the screen: away from the move stick
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 400, right: 1000, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  raw = {
    moveX: 0, moveY: 0, pointerX: 0, pointerY: 0, primaryDown: false, primaryPresses: 0, primaryReleases: 0,
    secondaryPresses: 0, dodgePresses: 0, abilitySlot: 0, directional: false, aimDirX: 1, aimDirY: 0, aimIdle: true,
  } as unknown as RawInput;
  touch = new TouchInput();
  touch.attach(target, raw, () => {});
});

afterEach(() => {
  touch.detach();
  vi.restoreAllMocks();
});

it('a quick tap on the open screen grabs when empty-handed', () => {
  pointer('pointerdown', 800, 200);
  expect(raw.primaryPresses).toBe(0);
  now += 80;
  pointer('pointerup', 800, 200, window);
  expect(raw.primaryPresses).toBe(1);
  expect(raw.primaryDown).toBe(false);
});

it('a quick tap while carrying does not throw', () => {
  document.body.classList.add('carrying');
  pointer('pointerdown', 800, 200);
  now += 80;
  touch.poll(raw);
  pointer('pointerup', 800, 200, window);
  expect(raw.primaryPresses).toBe(0);
  expect(raw.primaryReleases).toBe(0);
});

it('a hold presses after a moment, and letting go throws', () => {
  document.body.classList.add('carrying');
  pointer('pointerdown', 800, 200);
  now += 100;
  touch.poll(raw);
  expect(raw.primaryPresses).toBe(0);
  now += 100;
  touch.poll(raw);
  expect(raw.primaryPresses).toBe(1);
  expect(raw.primaryDown).toBe(true);
  pointer('pointerup', 800, 200, window);
  expect(raw.primaryReleases).toBe(1);
  expect(raw.primaryDown).toBe(false);
});

it('a small wobble does not aim; a real drag aims and presses at once', () => {
  document.body.classList.add('carrying');
  pointer('pointerdown', 800, 200);
  pointer('pointermove', 812, 205, window);
  expect(raw.aimIdle).toBe(true);
  expect(raw.primaryPresses).toBe(0);
  pointer('pointermove', 800, 160, window);
  expect(raw.aimIdle).toBe(false);
  expect(raw.primaryPresses).toBe(1);
  expect(raw.aimDirX).toBeCloseTo(0, 5);
  expect(raw.aimDirY).toBeCloseTo(-1, 5);
});
