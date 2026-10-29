import { describe, expect, it } from 'vitest';
import { gate, resetVoiceState } from './PetVoices';

describe('pet voice gating', () => {
  it('lets the first call through and blocks the same pet until the cooldown passes', () => {
    resetVoiceState();
    expect(gate('cat:hello')).toBe(true);
    expect(gate('cat:hello')).toBe(false);
    expect(gate('dog:bark')).toBe(true);
  });

  it('caps the number of simultaneous voices in a window', () => {
    resetVoiceState();
    let through = 0;
    for (let i = 0; i < 12; i++) {
      if (gate(`hamster:${i % 2}`)) through++;
    }
    expect(through).toBeLessThanOrEqual(4);
  });

  it('lets a different pet speak while another is on cooldown', () => {
    resetVoiceState();
    expect(gate('cat:hello')).toBe(true);
    expect(gate('dog:bark')).toBe(true);
    expect(gate('parrot:squawk')).toBe(true);
    expect(gate('hamster:squeak')).toBe(true);
  });
});