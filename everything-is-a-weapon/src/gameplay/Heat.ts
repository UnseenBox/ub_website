export type HeatEvent =
  | { kind: 'tier'; tier: 1 | 2 }
  | { kind: 'release' }
  | { kind: 'surge' };

export interface HeatRoomView {
  elapsed: number;
  pending: ReadonlyArray<{ incident?: unknown }>;
  incidentSpec: unknown | null;
  survive: number | null;
}

export interface HeatEnemyView {
  defeated: boolean;
  incident: 'headliner' | 'enforcer' | null;
}

export const TIER_1 = 34;
export const TIER_2 = 67;
export const MAX_HEAT = 100;
export const PASSIVE = 0.6;
export const LATE = 5;
export const EMPTY = 20;

/**
 * Chaos becomes an incident. A room is quiet until the player makes noise, then
 * the heat climbs faster once the regular crew is gone or the fight drags on.
 */
export class HeatSystem {
  heat = 0;
  tier: 0 | 1 | 2 = 0;
  active = false;
  released = false;

  reset(room: HeatRoomView): void {
    this.heat = 0;
    this.tier = 0;
    this.active = room.incidentSpec !== null || room.survive !== null;
    this.released = false;
  }

  add(amount: number): void {
    if (!this.active || !Number.isFinite(amount) || amount <= 0) return;
    this.heat = Math.min(MAX_HEAT, this.heat + amount);
  }

  update(
    dt: number,
    room: HeatRoomView,
    enemies: readonly HeatEnemyView[],
    emit: (event: HeatEvent) => void,
  ): void {
    if (!this.active || this.released) return;

    const hasRegularPending = room.pending.some((pending) => !pending.incident);
    const hasRegularAlive = enemies.some((enemy) => !enemy.defeated && enemy.incident === null);
    let rate = PASSIVE;
    if (room.elapsed > 90) rate += LATE;
    if (!hasRegularPending && !hasRegularAlive) rate += EMPTY;

    this.heat = Math.min(MAX_HEAT, this.heat + Math.max(0, dt) * rate);

    if (this.heat >= TIER_1 && this.tier < 1) {
      this.tier = 1;
      emit({ kind: 'tier', tier: 1 });
    }
    if (this.heat >= TIER_2 && this.tier < 2) {
      this.tier = 2;
      emit({ kind: 'tier', tier: 2 });
    }
    if (this.heat >= MAX_HEAT) {
      this.released = true;
      emit({ kind: room.incidentSpec !== null ? 'release' : 'surge' });
    }
  }
}
