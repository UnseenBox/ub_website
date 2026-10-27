import { describe, expect, it } from 'vitest';
import { ParticleSystem } from './ParticleSystem';

describe('particle pool', () => {
  it('never exceeds its fixed pool, even under a huge burst', () => {
    const particles = new ParticleSystem();
    particles.burst('spark', 10, 10, 5000, 300);
    expect(particles.activeCount).toBeLessThanOrEqual(particles.pool.length);
    expect(particles.pool.length).toBeLessThan(1000);
  });

  it('returns expired particles to the free list', () => {
    const particles = new ParticleSystem();
    particles.burst('dust', 0, 0, 40, 100);
    particles.update(0.016);
    expect(particles.activeCount).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) particles.update(0.1);
    expect(particles.activeCount).toBe(0);
    particles.burst('dust', 0, 0, 40, 100);
    particles.update(0.016);
    expect(particles.activeCount).toBeGreaterThan(0);
  });
});
