// Mission objectives that live on the battlefield: a structure to protect, or
// vehicles to escort across the field. Pure logic; GameScene draws the targets
// and sends zombies after them.

import { plural, type AssetKind, type Objective } from '../data/missions';
import { windowHalfWidth } from '../game/perspective';
import type { FieldGoal } from '../entities/Zombie';

export interface FieldTarget extends FieldGoal {
  id: number;
  kind: AssetKind | 'bus' | 'truck' | 'train' | 'nest';
  name: string;
  hp: number;
  max: number;
  /** m/s across the field (vehicles); 0 for structures. */
  speed: number;
  alive: boolean;
}

export type ObjectiveEvent =
  | { type: 'vehicleStart'; target: FieldTarget }
  | { type: 'vehicleSaved'; target: FieldTarget }
  | { type: 'vehicleLost'; target: FieldTarget }
  | { type: 'assetDestroyed'; target: FieldTarget }
  | { type: 'nestSpawn'; target: FieldTarget }
  | { type: 'nestDestroyed'; target: FieldTarget };

/** Half-lengths of the targets in metres (how close sideways a zombie must get). */
const HALF_WIDTH: Record<FieldTarget['kind'], number> = { mast: 1.6, fuel: 3.2, wreck: 4, generator: 2.4, bus: 4.6, truck: 4, train: 5.6, nest: 2 };
/** Where fog nests grow, in metres (x across, z out). Up to four per mission. */
export const NEST_SPOTS: [number, number][] = [[-10, 42], [9, 48], [-3, 62], [15, 36]];
/** Vehicles start and finish this far beyond the edge of the window. */
const OFFSCREEN = 7;
/** Seconds into the first wave before the first vehicle sets off. */
const FIRST_VEHICLE = 8;
/** Once the waves are over, waiting vehicles leave this quickly. */
const RUSH_INTERVAL = 3;

export class ObjectiveState {
  readonly targets: FieldTarget[] = [];
  saved = 0;
  lost = 0;
  launched = 0;
  private nextId = 1;
  private timer = FIRST_VEHICLE;
  private rushing = false;
  private destroyed = false;

  /** Seconds to each nest's next spawn, by target id. */
  private nestTimers = new Map<number, number>();

  constructor(readonly objective: Objective) {
    if (objective.kind === 'protect') {
      this.targets.push(this.make(objective.asset, objective.name, objective.x, objective.z, objective.health, 0));
    }
    if (objective.kind === 'nests') {
      NEST_SPOTS.slice(0, objective.count).forEach(([x, z], i) => {
        const nest = this.make('nest', `NEST ${i + 1}`, x, z, objective.health, 0);
        this.targets.push(nest);
        this.nestTimers.set(nest.id, objective.spawn.every * (0.5 + i * 0.25));
      });
    }
  }

  /** Fog nests still standing. */
  get nestsLeft(): number {
    return this.targets.filter((t) => t.kind === 'nest' && t.alive).length;
  }

  private make(kind: FieldTarget['kind'], name: string, x: number, z: number, hp: number, speed: number): FieldTarget {
    return { id: this.nextId++, kind, name, x, z, halfWidth: HALF_WIDTH[kind], hp, max: hp, speed, alive: true };
  }

  /** Share of new arrivals that go for a field target instead of the bunker. */
  get share(): number {
    const o = this.objective;
    return o.kind === 'protect' || o.kind === 'evacuate' ? o.share : 0;
  }

  /** The target new arrivals should go for, if any (the dead never guard their own nests). */
  get current(): FieldTarget | null {
    return this.targets.find((t) => t.alive && t.kind !== 'nest') ?? null;
  }

  /** The mission is lost: the asset fell, or too many vehicles did. */
  get failed(): boolean {
    const o = this.objective;
    if (o.kind === 'protect') return this.destroyed;
    if (o.kind === 'evacuate') return this.lost > o.vehicles - o.mustSave;
    return false;
  }

  /** Vehicles still to cross, or nests still standing; the mission waits for them after the last wave. */
  get pending(): boolean {
    const o = this.objective;
    if (o.kind === 'nests') return this.nestsLeft > 0;
    return o.kind === 'evacuate' && this.saved + this.lost < o.vehicles;
  }

  /** The waves are over: send the waiting vehicles now. */
  rush(): void {
    this.rushing = true;
    this.timer = Math.min(this.timer, RUSH_INTERVAL);
  }

  /** Advance vehicles. `active` is true while a wave is running (or after a rush). */
  update(dt: number, active: boolean): ObjectiveEvent[] {
    const events: ObjectiveEvent[] = [];
    const o = this.objective;
    if (o.kind === 'nests') {
      // Nests breed while a wave runs, and keep breeding after the last one until they fall.
      if (!active && !this.rushing) return events;
      for (const t of this.targets) {
        if (!t.alive) continue;
        const left = (this.nestTimers.get(t.id) ?? o.spawn.every) - dt;
        if (left <= 0) {
          events.push({ type: 'nestSpawn', target: t });
          this.nestTimers.set(t.id, o.spawn.every);
        } else this.nestTimers.set(t.id, left);
      }
      return events;
    }
    if (o.kind !== 'evacuate') return events;
    if ((active || this.rushing) && this.launched < o.vehicles && !this.targets.some((t) => t.alive)) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const edge = windowHalfWidth(o.z) + OFFSCREEN;
        const bus = this.make(o.name === 'TRUCK' ? 'truck' : o.name === 'TRAIN' ? 'train' : 'bus', `${o.name} ${this.launched + 1}`, -edge, o.z, o.health, o.speed);
        this.targets.push(bus);
        this.launched++;
        this.timer = this.rushing ? RUSH_INTERVAL : o.interval;
        events.push({ type: 'vehicleStart', target: bus });
      }
    }
    for (const t of this.targets) {
      if (!t.alive || t.speed <= 0) continue;
      t.x += t.speed * dt;
      if (t.x >= windowHalfWidth(t.z) + OFFSCREEN) {
        t.alive = false;
        this.saved++;
        events.push({ type: 'vehicleSaved', target: t });
      }
    }
    return events;
  }

  /** Damage a target. Returns an event when it is destroyed by this hit. */
  damage(t: FieldTarget, amount: number): ObjectiveEvent | null {
    if (!t.alive || amount <= 0) return null;
    t.hp = Math.max(0, t.hp - amount);
    if (t.hp > 0) return null;
    t.alive = false;
    if (t.kind === 'bus' || t.kind === 'truck' || t.kind === 'train') {
      this.lost++;
      return { type: 'vehicleLost', target: t };
    }
    if (t.kind === 'nest') return { type: 'nestDestroyed', target: t };
    this.destroyed = true;
    return { type: 'assetDestroyed', target: t };
  }

  /** For the results: protected asset health, or vehicles saved. */
  summary(): { assetFraction?: number; saved?: number; vehicles?: number } {
    const o = this.objective;
    if (o.kind === 'protect') {
      const t = this.targets[0];
      return { assetFraction: t ? t.hp / t.max : 0 };
    }
    if (o.kind === 'evacuate') return { saved: this.saved, vehicles: o.vehicles };
    return {};
  }

  /** One line for the HUD. */
  status(): string {
    const o = this.objective;
    if (o.kind === 'protect') {
      const t = this.targets[0];
      return `${t.name} ${Math.ceil((t.hp / t.max) * 100)}%`;
    }
    if (o.kind === 'nests') return `FOG NESTS LEFT ${this.nestsLeft}/${o.count}`;
    if (o.kind === 'evacuate') {
      const bus = this.targets.find((t) => t.alive);
      const onRoad = bus ? `  ·  ON THE ROAD ${Math.ceil((bus.hp / bus.max) * 100)}%` : '';
      return `${plural(o.name)} SAVED ${this.saved}/${o.mustSave}  ·  LOST ${this.lost}${onRoad}`;
    }
    return '';
  }
}
