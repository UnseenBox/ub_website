import { newUid, type Chain } from '../core/types';
import type { Game } from '../core/Game';
import type { PhysicsObject } from '../entities/PhysicsObject';
import type { Enemy } from '../entities/Enemy';

export type ZoneKind =
  | 'water' | 'electric' | 'fire' | 'glass' | 'foam' | 'dirt' | 'mud' | 'wind'
  | 'oil' | 'flour' | 'slick' | 'paint'
  | 'trap' | 'magnet' | 'music' | 'feathers' | 'steam';

const ZONE_LABELS: Readonly<Record<ZoneKind, string>> = {
  water: 'WATER',
  electric: 'ELECTRICITY',
  fire: 'FIRE',
  glass: 'BROKEN GLASS',
  foam: 'FOAM',
  dirt: 'DIRT',
  mud: 'MUD',
  wind: 'WIND',
  oil: 'OIL',
  flour: 'FLOUR',
  slick: 'SOMETHING SLIPPERY',
  paint: 'WET PAINT',
  trap: 'TRAP',
  magnet: 'MAGNETISM',
  music: 'MUSIC',
  feathers: 'FEATHERS',
  steam: 'STEAM',
};

export interface ZoneOptions {
  ttl?: number;
  attached?: PhysicsObject | Enemy | null;
  /** Distance along the carrier's facing at which the zone sits. */
  offset?: number;
  chain?: Chain | null;
  /** Electric level: how many conductors the current can still jump through. */
  level?: number;
  /** Zone dies as soon as its carrier loses this tag. */
  emitterTag?: string;
  extraTags?: readonly string[];
}

/**
 * A circular trigger area with a hazard state. Zones never push anything physically;
 * the interaction rules decide what overlapping one means.
 */
export class Zone {
  readonly kind = 'zone' as const;
  readonly uid = newUid();
  readonly tags = new Set<string>();
  readonly seed = Math.random() * 1000;
  zone: ZoneKind;
  label: string;
  x: number;
  y: number;
  r: number;
  ttl: number;
  age = 0;
  alive = true;
  chain: Chain | null;
  chainAt: number;
  attached: PhysicsObject | Enemy | null;
  offset: number;
  emitterTag: string | null;
  level: number;
  /** Water only: sim time until which the puddle stays electrified. */
  energizedUntil = 0;
  dirX = 1;
  dirY = 0;
  /** Enemy whose ability created this zone; its own furniture cannot hurt it. */
  sourceUid = 0;

  constructor(zone: ZoneKind, x: number, y: number, r: number, now: number, options: ZoneOptions = {}) {
    this.zone = zone;
    this.label = ZONE_LABELS[zone];
    this.x = x;
    this.y = y;
    this.r = r;
    this.ttl = options.ttl ?? Infinity;
    this.attached = options.attached ?? null;
    this.offset = options.offset ?? 0;
    this.chain = options.chain ?? null;
    this.chainAt = now;
    this.level = options.level ?? 0;
    this.emitterTag = options.emitterTag ?? null;
    this.tags.add('zone');
    this.tags.add(zone);
    if (options.extraTags) for (const tag of options.extraTags) this.tags.add(tag);
  }

  get energized(): boolean {
    return this.tags.has('energized');
  }

  retype(zone: ZoneKind): void {
    this.tags.delete(this.zone);
    this.tags.delete('energized');
    this.zone = zone;
    this.label = ZONE_LABELS[zone];
    this.tags.add(zone);
  }
}

const MAX_ZONES = 70;

export class ZoneManager {
  readonly zones: Zone[] = [];

  spawn(game: Game, zone: ZoneKind, x: number, y: number, r: number, options: ZoneOptions = {}): Zone {
    const created = new Zone(zone, x, y, r, game.time, options);
    this.zones.push(created);
    if (created.attached) this.follow(created);
    // Oldest temporary zones make room when a room gets truly chaotic.
    if (this.zones.length > MAX_ZONES) {
      const victim = this.zones.find((z) => z.alive && Number.isFinite(z.ttl) && !z.attached);
      if (victim) victim.alive = false;
    }
    return created;
  }

  clear(): void {
    this.zones.length = 0;
  }

  update(game: Game, dt: number): void {
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i]!;
      if (!z.alive) continue;
      z.age += dt;
      if (Number.isFinite(z.ttl)) {
        z.ttl -= dt;
        if (z.ttl <= 0) z.alive = false;
      }
      if (z.attached) {
        const carrier = z.attached;
        const gone = carrier.kind === 'enemy' ? carrier.defeated || !carrier.alive : !carrier.alive;
        if (gone || (z.emitterTag !== null && !carrier.tags.has(z.emitterTag))) z.alive = false;
        else this.follow(z);
      }
      if (z.zone === 'water' && z.energized && game.time > z.energizedUntil) {
        z.tags.delete('energized');
        z.level = 0;
      }
    }

    let write = 0;
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i]!;
      if (z.alive) this.zones[write++] = z;
      else if (z.zone === 'fire' && z.attached && z.attached.kind === 'object' && z.attached.fireZone === z) {
        z.attached.fireZone = null;
      }
    }
    this.zones.length = write;
  }

  private follow(z: Zone): void {
    const carrier = z.attached;
    if (!carrier) return;
    const body = carrier.body;
    const angle = carrier.kind === 'enemy' ? carrier.facing : body.angle;
    z.dirX = Math.cos(angle);
    z.dirY = Math.sin(angle);
    z.x = body.x + z.dirX * z.offset;
    z.y = body.y + z.dirY * z.offset;
  }
}
