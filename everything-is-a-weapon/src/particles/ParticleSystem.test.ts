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

describe('adaptive quality', () => {
  it('step 1 halves the burst, step 3 drops single-particle trails', () => {
  const sys = new ParticleSystem();
  const live = (): number => sys.pool.filter((p) => p.active).length;
  sys.burst('dust', 0, 0, 40, 100);
  const full = live();
  sys.clear();
  sys.quality = 1;
  sys.burst('dust', 0, 0, 40, 100);
  expect(full).toBe(20);
  expect(live()).toBe(10);
  sys.clear();
  sys.quality = 3;
  sys.burst('dust', 0, 0, 1, 40);
  expect(live(), 'a trail particle is skipped').toBe(0);
  sys.burst('dust', 0, 0, 40, 100);
  expect(live(), 'a real burst still shows').toBeGreaterThan(0);
});
});
