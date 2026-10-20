import { describe, expect, it } from 'vitest';
import { HeatSystem, type HeatEnemyView, type HeatEvent, type HeatRoomView } from './Heat';

function room(overrides: Partial<HeatRoomView> = {}): HeatRoomView {
  return {
    elapsed: 0,
    pending: [],
    incidentSpec: null,
    survive: null,
    ...overrides,
  };
}

function enemy(overrides: Partial<HeatEnemyView> = {}): HeatEnemyView {
  return { defeated: false, incident: null, ...overrides };
}

describe('HeatSystem', () => {
  it('tutorial room is cold', () => {
    const heat = new HeatSystem();
    const events: HeatEvent[] = [];
    heat.reset(room());
    heat.update(120, room({ elapsed: 120 }), [], (event) => events.push(event));
    expect(heat.active).toBe(false);
    expect(heat.heat).toBe(0);
    expect(events).toEqual([]);
  });

  it('crosses tier 1 and tier 2 at 34 and 67', () => {
    const heat = new HeatSystem();
    const events: HeatEvent[] = [];
    heat.reset(room({ incidentSpec: {} }));
    heat.add(34);
    heat.update(0, room({ incidentSpec: {} }), [], (event) => events.push(event));
    expect(heat.tier).toBe(1);
    expect(events).toEqual([{ kind: 'tier', tier: 1 }]);

    heat.add(33);
    heat.update(0, room({ incidentSpec: {} }), [], (event) => events.push(event));
    expect(heat.tier).toBe(2);
    expect(events).toEqual([{ kind: 'tier', tier: 1 }, { kind: 'tier', tier: 2 }]);
  });

  it('releases the incident at 100', () => {
    const heat = new HeatSystem();
    const events: HeatEvent[] = [];
    const view = room({ incidentSpec: {} });
    heat.reset(view);
    heat.add(100);
    heat.update(0, view, [], (event) => events.push(event));
    expect(heat.released).toBe(true);
    expect(events[events.length - 1]).toEqual({ kind: 'release' });
  });

  it('surges instead of releasing in a survival room', () => {
    const heat = new HeatSystem();
    const events: HeatEvent[] = [];
    const view = room({ survive: 30 });
    heat.reset(view);
    heat.add(100);
    heat.update(0, view, [], (event) => events.push(event));
    expect(heat.released).toBe(true);
    expect(events[events.length - 1]).toEqual({ kind: 'surge' });
  });

  it('accelerates when no regulars remain', () => {
    const busy = new HeatSystem();
    const empty = new HeatSystem();
    const view = room({ incidentSpec: {} });
    const busyView = room({ incidentSpec: {}, pending: [{ incident: undefined }] });
    busy.reset(busyView);
    empty.reset(view);
    busy.update(1, busyView, [enemy()], () => {});
    empty.update(1, view, [], () => {});
    expect(empty.heat).toBeGreaterThan(busy.heat);
  });

  it('accelerates after 90 seconds', () => {
    const early = new HeatSystem();
    const late = new HeatSystem();
    const earlyView = room({ incidentSpec: {}, pending: [{ incident: undefined }] });
    const lateView = room({ elapsed: 91, incidentSpec: {}, pending: [{ incident: undefined }] });
    early.reset(earlyView);
    late.reset(lateView);
    early.update(1, earlyView, [enemy()], () => {});
    late.update(1, lateView, [enemy()], () => {});
    expect(late.heat).toBeGreaterThan(early.heat);
  });

  it('does not release twice', () => {
    const heat = new HeatSystem();
    const events: HeatEvent[] = [];
    const view = room({ incidentSpec: {} });
    heat.reset(view);
    heat.add(100);
    heat.update(0, view, [], (event) => events.push(event));
    heat.update(5, view, [], (event) => events.push(event));
    expect(events.filter((event) => event.kind === 'release')).toHaveLength(1);
  });
});
