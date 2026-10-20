import { describe, expect, it } from 'vitest';
import {
  enforcerSpec,
  headlinerSpec,
  releaseIncident,
  rushRegulars,
  type PendingEnemy,
} from './Incidents';

function pending(type: PendingEnemy['type'], delay: number, incident?: PendingEnemy['incident']): PendingEnemy {
  return { type, delay, incident };
}

describe('Incidents', () => {
  it('headlinerSpec returns the boss name and banner', () => {
    const spec = headlinerSpec('chairman');
    expect(spec.kind).toBe('headliner');
    expect(spec.name).toBe('CHAIRMAN OF CHAOS');
    expect(spec.baseType).toBe('chairman');
    expect(spec.hpScale).toBe(1);
    expect(spec.line.length).toBeGreaterThan(0);
  });

  it('enforcerSpec(0) is the Foreman at 2.2 HP', () => {
    const spec = enforcerSpec(0);
    expect(spec.kind).toBe('enforcer');
    expect(spec.name).toBe('THE FOREMAN');
    expect(spec.baseType).toBe('heavy');
    expect(spec.hpScale).toBeCloseTo(2.2);
  });

  it('enforcerSpec(7) is 2.2', () => {
    expect(enforcerSpec(7).hpScale).toBeCloseTo(2.2);
  });

  it('enforcerSpec(20) caps at 3.0', () => {
    expect(enforcerSpec(20).hpScale).toBe(3);
  });

  it('releaseIncident sets a walk-in delay and marks the room', () => {
    const incident = enforcerSpec(0);
    const room = {
      elapsed: 10,
      bossReleased: false,
      pending: [pending('basic', 2), pending('heavy', Number.POSITIVE_INFINITY, incident)],
    };
    expect(releaseIncident(room)).toBe(true);
    expect(room.bossReleased).toBe(true);
    expect(room.pending.find((spec) => spec.incident)?.delay).toBe(15.2);
    expect(room.pending[0]?.incident).toBeUndefined();
  });

  it('rushRegulars moves only regulars', () => {
    const incident = enforcerSpec(0);
    const room = {
      elapsed: 10,
      bossReleased: false,
      pending: [pending('basic', 60), pending('heavy', 50, incident)],
    };
    rushRegulars(room);
    expect(room.pending[0]?.delay).toBe(12);
    expect(room.pending[1]?.delay).toBe(50);
  });

  it('releaseIncident returns false when there is no incident', () => {
    const room = {
      elapsed: 1,
      bossReleased: false,
      pending: [pending('basic', 2)],
    };
    expect(releaseIncident(room)).toBe(false);
    expect(room.bossReleased).toBe(false);
  });
});
