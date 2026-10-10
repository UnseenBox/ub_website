import { LIGHT, VIEW } from '../core/Tuning';
import { clamp01, dist, type Rect } from '../core/Mathx';
import type { EnemySpawn } from '../enemies/Enemy';
import { Enemy } from '../enemies/Enemy';
import type { ObjectiveSpec } from '../gameplay/ObjectiveSystem';
import type { BloodDecal } from '../rendering/SceneArt';
import { WorldObject, type ObjectSpawn } from './WorldObject';

export interface LightSpec {
  id: string;
  x: number;
  y: number;
  radius: number;
  /** 0..1 how much of the darkness this light lifts at its centre. */
  intensity: number;
  /** Warm lamp, cold screen, and so on. */
  tint?: string;
  on?: boolean;
  /** Amount of idle flicker, 0..1. */
  flicker?: number;
  /** A cone instead of a disc: facing in radians plus half-angle. */
  cone?: { facing: number; spread: number };
  /**
   * Draw the lamp itself: a lit ceiling panel at the light's position. A room
   * reads as lit rather than merely tinted when you can see what is doing it.
   */
  fixture?: { w: number; h: number; x?: number; y?: number };
}

export interface RoomEventSpec {
  /** Seconds into the attempt, or a condition evaluated by the room. */
  at?: number;
  /** Fires once when the player first gets within `radius` of (x, y). */
  trigger?: { x: number; y: number; radius: number };
  /** Fires once when this object reaches this state. */
  onObjectState?: { id: string; state: string };
  kind:
    | 'LIGHTS_OUT'
    | 'DOOR_CLOSES'
    | 'WHISPER'
    | 'MOVE_OBJECT'
    | 'SECOND_CURSOR'
    | 'ENEMY_VANISH'
    | 'WAKE_ENEMY';
  /** Which thing it happens to. */
  targetId?: string;
  /** Free parameter: offset for MOVE_OBJECT, duration for others. */
  a?: number;
  b?: number;
  /** Line shown as a toast, when the event says something. */
  text?: string;
  /** Only fires if the player has done this at least `times` times before. */
  requiresHabit?: { key: string; times: number };
}

export interface RoomDefinition {
  readonly id: string;
  readonly name: string;
  /** The one idea this room exists to teach. */
  readonly teaches: string;
  /** Objective line shown in the HUD. */
  readonly brief: string;
  readonly ambient: number;
  /** Opening lines, shown once, before the room fades in. */
  readonly intro?: readonly string[];
  /** Target time for the speed bonus, in seconds. */
  readonly parTime: number;
  readonly playerSpawn: { x: number; y: number };
  readonly walls: readonly Rect[];
  readonly lights: readonly LightSpec[];
  readonly objects: readonly ObjectSpawn[];
  readonly enemies: readonly EnemySpawn[];
  readonly objective: ObjectiveSpec;
  readonly events?: readonly RoomEventSpec[];
  /** Hidden extras worth score, referenced by object id. */
  readonly secrets?: readonly string[];
  /**
   * Dried blood left by whoever was here before you. Pure set dressing, and the
   * only red in a room until you make some of your own.
   */
  readonly blood?: readonly { x: number; y: number; size: number; seed?: number }[];
}

export class Light {
  readonly id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  readonly tint: string;
  on: boolean;
  readonly flickerAmount: number;
  readonly cone: { facing: number; spread: number } | undefined;
  readonly fixture: { w: number; h: number; x?: number; y?: number } | undefined;
  /** Live multiplier, 1 normally, wobbling when the room is tense. */
  flicker = 1;
  private phase = Math.random() * 100;

  constructor(spec: LightSpec) {
    this.id = spec.id;
    this.x = spec.x;
    this.y = spec.y;
    this.radius = spec.radius;
    this.intensity = spec.intensity;
    this.tint = spec.tint ?? '#ffd9a0';
    this.on = spec.on ?? true;
    this.flickerAmount = spec.flicker ?? 0;
    this.cone = spec.cone;
    this.fixture = spec.fixture;
  }

  update(dt: number, tension: number): void {
    this.phase += dt;
    const amount = this.flickerAmount + tension * 0.1;
    if (amount <= 0) {
      this.flicker = 1;
      return;
    }
    const n =
      Math.sin(this.phase * 37.1) * 0.5 + Math.sin(this.phase * 11.3) * 0.3 + Math.sin(this.phase * 71.7) * 0.2;
    this.flicker = 1 - amount * (0.5 + 0.5 * n);
  }

  /** 0..1 contribution of this light at a point. */
  contributionAt(x: number, y: number): number {
    if (!this.on) return 0;
    const d = dist(this.x, this.y, x, y);
    if (d >= this.radius) return 0;
    let falloff = 1 - d / this.radius;
    falloff *= falloff;
    if (this.cone) {
      const a = Math.atan2(y - this.y, x - this.x);
      let diff = Math.abs(a - this.cone.facing) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > this.cone.spread) return 0;
      falloff *= 1 - clamp01((diff - this.cone.spread * 0.6) / (this.cone.spread * 0.4));
    }
    return falloff * this.intensity * this.flicker;
  }
}

/**
 * A live room: the authored definition instantiated into objects, creatures and
 * lights, plus the queries every other system asks of the world.
 */
export class Room {
  readonly def: RoomDefinition;
  readonly objects: WorldObject[] = [];
  readonly enemies: Enemy[] = [];
  readonly lights: Light[] = [];
  readonly blood: BloodDecal[] = [];

  /** 0..1 how worked up the room is. Drives flicker, ambience and vignette. */
  tension = 0;
  /** Extra sound in the air that makes it harder for creatures to pick out a click. */
  noiseMask = 0;

  private readonly wallRects: Rect[] = [];
  private readonly solidCache: Rect[] = [];
  private readonly blockerCache: Rect[] = [];
  private cacheDirty = true;

  readonly firedEvents = new Set<number>();

  constructor(definition: RoomDefinition) {
    this.def = definition;
    this.wallRects = definition.walls.map((w) => ({ ...w }));
    for (const spec of definition.lights) this.lights.push(new Light(spec));
    for (const spawn of definition.objects) this.objects.push(new WorldObject(spawn));
    for (const spawn of definition.enemies) this.enemies.push(new Enemy(spawn));
    for (let i = 0; i < (definition.blood?.length ?? 0); i++) {
      const b = definition.blood![i];
      this.blood.push({ x: b.x, y: b.y, size: b.size, seed: b.seed ?? 1000 + i * 97, fresh: 0 });
    }
  }

  /** Leave a mark. Fresh blood is brighter than what was already on the floor. */
  addBlood(x: number, y: number, size: number): void {
    this.blood.push({ x, y, size, seed: (Math.random() * 1e6) | 0, fresh: 1 });
  }

  get ambient(): number {
    return this.def.ambient;
  }

  markGeometryDirty(): void {
    this.cacheDirty = true;
  }

  /** Walls plus solid props. Rebuilt only when something opens or closes. */
  get solids(): readonly Rect[] {
    this.rebuildCaches();
    return this.solidCache;
  }

  /** Walls plus opaque props. What line of sight is tested against. */
  get blockers(): readonly Rect[] {
    this.rebuildCaches();
    return this.blockerCache;
  }

  get walls(): readonly Rect[] {
    return this.wallRects;
  }

  private rebuildCaches(): void {
    if (!this.cacheDirty) return;
    this.cacheDirty = false;
    this.solidCache.length = 0;
    this.blockerCache.length = 0;
    for (const w of this.wallRects) {
      this.solidCache.push(w);
      this.blockerCache.push(w);
    }
    for (const o of this.objects) {
      if (o.blocksMovement) this.solidCache.push(o.rect);
      if (o.blocksSight) this.blockerCache.push(o.rect);
    }
  }

  findObject(id: string): WorldObject | undefined {
    return this.objects.find((o) => o.id === id);
  }

  findLight(id: string): Light | undefined {
    return this.lights.find((l) => l.id === id);
  }

  findEnemyByTag(tag: string): Enemy | undefined {
    return this.enemies.find((e) => e.tag === tag);
  }

  /** 0..1 light level, which is how visible a body is at that spot. */
  lightAt(x: number, y: number): number {
    let total = this.def.ambient;
    for (let i = 0; i < this.lights.length; i++) {
      total += this.lights[i].contributionAt(x, y);
    }
    return clamp01(total);
  }

  /** 0..1 how dark the room is on average right now. */
  get darkness(): number {
    let lit = 0;
    const samples = 9;
    for (let i = 0; i < samples; i++) {
      const x = ((i % 3) + 0.5) * (VIEW.width / 3);
      const y = (Math.floor(i / 3) + 0.5) * (VIEW.height / 3);
      lit += this.lightAt(x, y);
    }
    return clamp01(1 - lit / samples);
  }

  /** Lowest light level reached by any light source, used for the minimum visibility floor. */
  get minVisibility(): number {
    return LIGHT.minVisibility;
  }

  update(dt: number): void {
    let rank = 0;
    for (const e of this.enemies) {
      rank = Math.max(rank, e.awareness);
    }
    this.tension += (clamp01(rank) - this.tension) * Math.min(1, dt * 3);

    let mask = 0;
    for (const o of this.objects) {
      o.tick(dt);
      if (o.def.loopNoise && o.state === o.def.loopNoise.state) {
        mask = Math.max(mask, clamp01(o.def.loopNoise.level / 14));
      }
    }
    this.noiseMask = mask;

    for (const l of this.lights) l.update(dt, this.tension);
  }

  /** Any object whose hit box contains the point, topmost first. */
  objectAt(x: number, y: number): WorldObject | null {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (!o.revealed || o.taken) continue;
      const r = o.hitRect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return o;
    }
    return null;
  }

  /** Nearest interactable object within a radius of a point. */
  nearestInteractable(x: number, y: number, radius: number): WorldObject | null {
    let best: WorldObject | null = null;
    let bestD = radius;
    for (const o of this.objects) {
      if (!o.def.interactable || o.taken || !o.revealed) continue;
      const d = dist(x, y, o.x, o.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }
}
