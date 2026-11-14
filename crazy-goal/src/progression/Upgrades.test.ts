import { describe, expect, it } from 'vitest';
import { parseSave } from '../save/SaveManager';
import { abilityPrice, aimScale, curlScale, nextPrice, powerScale, UPGRADE_MAX } from './Upgrades';

describe('store upgrades', () => {
  it('price each level in turn and stop at the top', () => {
    expect(nextPrice('power', 0)).toBe(60);
    expect(nextPrice('power', 1)).toBe(140);
    expect(nextPrice('power', 2)).toBe(260);
    expect(nextPrice('power', UPGRADE_MAX)).toBeNull();
    expect(nextPrice('aim', 0)).toBe(40);
  });

  it('do nothing at level 0 and grow with each level', () => {
    expect(powerScale(0)).toBe(1);
    expect(curlScale(0)).toBe(1);
    expect(aimScale(0)).toBe(1);
    expect(powerScale(3)).toBeCloseTo(1.12);
    expect(curlScale(3)).toBeCloseTo(1.45);
    // Anything past the top counts as the top.
    expect(powerScale(9)).toBeCloseTo(1.12);
  });

  it('sell abilities singly at the shop price, and five for the price of four', () => {
    expect(abilityPrice('fire', 1)).toBe(15);
    expect(abilityPrice('magnet', 5)).toBe(80);
  });

  it('are saved, and a broken or missing save reads as no upgrades', () => {
    expect(parseSave(null).upgrades).toEqual({ power: 0, curl: 0, aim: 0 });
    const raw = JSON.stringify({ version: 2, upgrades: { power: 2, curl: 7, aim: 'x' } });
    expect(parseSave(raw).upgrades).toEqual({ power: 2, curl: UPGRADE_MAX, aim: 0 });
  });
});
