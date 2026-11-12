import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FUNNEL_KEY, FUNNEL_RING_SIZE, FunnelLog, daysBetween } from './FunnelLog';

class MemoryStorage {
  data = new Map<string, string>();
  writes = 0;
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.writes++; this.data.set(k, v); }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const make = (storage: MemoryStorage | null, now = new Date('2026-11-12T10:00:00Z')) =>
  new FunnelLog(storage as unknown as Storage | null, () => performance.now(), now);

it('counts events and keeps the first time of each', () => {
  const log = make(new MemoryStorage());
  log.track('first_throw', { ms: 5 });
  log.track('first_throw', { ms: 9 });
  expect(log.data.counters.first_throw).toBe(2);
  expect(log.data.firstMs.first_throw).toBeTypeOf('number');
});

it('caps the ring buffer', () => {
  const log = make(new MemoryStorage());
  for (let i = 0; i < FUNNEL_RING_SIZE + 50; i++) log.track('enemy_defeat', { i });
  expect(log.data.ring).toHaveLength(FUNNEL_RING_SIZE);
  expect(log.data.ring[log.data.ring.length - 1]?.params.i).toBe(FUNNEL_RING_SIZE + 49);
});

it('throttles writes to one per 2 seconds, and flush writes immediately', () => {
  const storage = new MemoryStorage();
  const log = make(storage);
  const before = storage.writes;
  for (let i = 0; i < 20; i++) log.track('object_grab', {});
  expect(storage.writes).toBe(before);
  vi.advanceTimersByTime(2100);
  expect(storage.writes).toBe(before + 1);
  log.track('object_grab', {});
  log.flush();
  expect(storage.writes).toBe(before + 2);
  expect(() => JSON.parse(storage.data.get(FUNNEL_KEY)!)).not.toThrow();
});

it('never throws when storage throws or is missing', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  expect(() => {
    const log = make(broken as unknown as MemoryStorage);
    log.track('room_end', { outcome: 'clear' });
    log.flush();
  }).not.toThrow();
  expect(() => make(null).track('boot', {})).not.toThrow();
});

it('counts sessions and days since the last visit', () => {
  const storage = new MemoryStorage();
  const first = make(storage, new Date('2026-11-10T10:00:00Z'));
  first.flush();
  expect(first.daysSinceLast).toBe(0);
  const second = make(storage, new Date('2026-11-12T10:00:00Z'));
  expect(second.data.sessionIndex).toBe(2);
  expect(second.daysSinceLast).toBe(2);
  expect(JSON.parse(second.summary()).sessionIndex).toBe(2);
});

it('ignores corrupt stored data', () => {
  const storage = new MemoryStorage();
  storage.setItem(FUNNEL_KEY, '{nope');
  expect(make(storage).data.sessionIndex).toBe(1);
  expect(daysBetween('x', 'y')).toBe(0);
});
