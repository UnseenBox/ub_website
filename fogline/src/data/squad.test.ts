import { describe, expect, it } from 'vitest';
import { RECRUITS } from './squad';

describe('squad radio', () => {
  it('gives every soldier a ready line and a set of chatter lines', () => {
    for (const r of RECRUITS) {
      expect(r.ready.length, r.id).toBeGreaterThan(10);
      expect(r.ready.length, r.id).toBeLessThanOrEqual(90);
      expect(r.lines.length, r.id).toBeGreaterThan(0);
    }
  });
});
