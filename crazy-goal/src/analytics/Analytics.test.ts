import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../core/EventBus';
import { Analytics, noopProvider, wireAnalytics } from './Analytics';

describe('Analytics', () => {
  it('hands every event to the provider', () => {
    const seen: [string, unknown][] = [];
    const a = new Analytics({ track: (n, p) => seen.push([n, p]) });
    a.track('level_start', { level: 3 });
    expect(seen).toEqual([['level_start', { level: 3 }]]);
  });

  it('never lets a broken provider reach the game', () => {
    const a = new Analytics({
      track() {
        throw new Error('boom');
      },
    });
    expect(() => a.track('x')).not.toThrow();
  });

  it('the production provider sends nothing', () => {
    expect(() => noopProvider.track('level_goal', { stars: 3 })).not.toThrow();
  });

  it('turns the game events of a session into the funnel', () => {
    const bus = new EventBus<GameEvents>();
    const seen: string[] = [];
    const off = wireAnalytics(bus, { track: (name) => seen.push(name) });
    bus.emit('LEVEL_STARTED', { level: 1, chapter: 1 });
    bus.emit('LEVEL_GOAL', { level: 1, stars: 2, score: 1400, attempts: 3, firstClear: true, bounces: 0 });
    bus.emit('BOOST_USED', { boost: 'magnet', free: true });
    bus.emit('AD_OFFERED', { kind: 'stuck' });
    bus.emit('AD_DONE', { kind: 'stuck', granted: true });
    bus.emit('LEVEL_GATE_BLOCKED', { level: 13, need: 16, have: 12 });
    expect(seen).toEqual(['level_start', 'level_goal', 'boost_used', 'ad_offer', 'ad_done', 'level_gate_blocked']);
    off();
    bus.emit('LEVEL_STARTED', { level: 2, chapter: 1 });
    expect(seen).toHaveLength(6);
  });
});
