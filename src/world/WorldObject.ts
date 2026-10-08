import { clamp01, type Rect } from '../core/Mathx';
import { getObjectDef, type ObjectDefinition, type ObjectKind } from './ObjectRegistry';

export interface ObjectSpawn {
  kind: ObjectKind;
  x: number;
  y: number;
  /** Stable id so rooms can link things together. Generated when omitted. */
  id?: string;
  state?: string;
  /** Ids of lights this object controls. */
  lights?: readonly string[];
  /** Ids of other objects this object operates (a button and its door). */
  targets?: readonly string[];
  /** Item id this container yields when opened. */
  contains?: string;
  /** Item id required to use it. */
  requires?: string;
  /** Overrides the definition footprint, for set dressing. */
  w?: number;
  h?: number;
  /** Where this vent comes out. */
  linkTo?: string;
  /** Flavour text shown when the cursor hovers it. */
  hint?: string;
  /** Rotation for art that cares, in radians. */
  angle?: number;
  /** Invisible and untouchable until the named container is open. */
  hiddenIn?: string;
}

let nextObjectId = 1;

/**
 * A live prop. Holds only state; its behaviour lives in InteractionSystem, which
 * is what keeps the prop table data and the prop logic in one small place each.
 */
export class WorldObject {
  readonly id: string;
  readonly def: ObjectDefinition;
  readonly kind: ObjectKind;

  x: number;
  y: number;
  readonly w: number;
  readonly h: number;
  vx = 0;
  vy = 0;

  state: string;
  readonly lights: readonly string[];
  readonly targets: readonly string[];
  readonly contains: string | undefined;
  readonly requires: string | undefined;
  readonly linkTo: string | undefined;
  readonly hint: string | undefined;
  readonly angle: number;
  readonly hiddenIn: string | undefined;

  /** Counts down a temporary state, such as a phone that only rings for a while. */
  stateTimer = 0;
  /** State to fall back to when `stateTimer` runs out. */
  revertTo: string | null = null;
  /** Set true once its container has been opened. */
  revealed = true;

  usesLeft: number;
  cooldown = 0;
  /** Progress through a timed interaction, 0..1. */
  progress = 0;
  busy = false;
  loopTimer = 0;
  /** Cosmetic: how far a door or drawer has swung, 0..1. */
  open = 0;
  /** Cosmetic: fades in when the object is doing something loud. */
  glow = 0;
  animPhase = Math.random() * 6.28;
  /** True once the player has pocketed this. */
  taken = false;
  /** Who is hiding inside, if anything. */
  occupied = false;

  constructor(spawn: ObjectSpawn) {
    this.def = getObjectDef(spawn.kind);
    this.kind = spawn.kind;
    this.id = spawn.id ?? `${spawn.kind.toLowerCase()}-${nextObjectId++}`;
    this.x = spawn.x;
    this.y = spawn.y;
    this.w = spawn.w ?? this.def.w;
    this.h = spawn.h ?? this.def.h;
    this.state = spawn.state ?? this.def.initialState;
    this.lights = spawn.lights ?? [];
    this.targets = spawn.targets ?? [];
    this.contains = spawn.contains;
    this.requires = spawn.requires;
    this.linkTo = spawn.linkTo;
    this.hint = spawn.hint;
    this.angle = spawn.angle ?? 0;
    this.hiddenIn = spawn.hiddenIn;
    this.revealed = !spawn.hiddenIn;
    this.usesLeft = this.def.uses;
    this.open = this.state === 'open' ? 1 : 0;
  }

  /** Footprint in world space, centred on (x, y). */
  get rect(): Rect {
    return { x: this.x - this.w * 0.5, y: this.y - this.h * 0.5, w: this.w, h: this.h };
  }

  /** Slightly generous box used for cursor hit testing. */
  get hitRect(): Rect {
    const pad = 5;
    return {
      x: this.x - this.w * 0.5 - pad,
      y: this.y - this.h * 0.5 - pad,
      w: this.w + pad * 2,
      h: this.h + pad * 2,
    };
  }

  get isOn(): boolean {
    return this.state === 'on' || this.state === 'ringing' || this.state === 'open';
  }

  get spent(): boolean {
    return this.usesLeft === 0;
  }

  get blocksMovement(): boolean {
    if (!this.def.solid || !this.revealed) return false;
    if (this.kind === 'DOOR' && this.state === 'open') return false;
    return true;
  }

  get blocksSight(): boolean {
    if (!this.def.opaque || !this.revealed) return false;
    if (this.kind === 'DOOR' && this.state === 'open') return false;
    return true;
  }

  /** Can the cursor currently do anything useful here? */
  get available(): boolean {
    if (!this.def.interactable) return false;
    if (!this.revealed) return false;
    if (this.taken) return false;
    if (this.spent) return false;
    if (this.cooldown > 0 || this.busy) return false;
    return true;
  }

  tick(dt: number): void {
    this.animPhase += dt;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0 && this.revertTo) {
        this.state = this.revertTo;
        this.revertTo = null;
      }
    }
    const openTarget = this.state === 'open' || this.state === 'ringing' ? 1 : 0;
    this.open += (openTarget - this.open) * Math.min(1, dt * 7);
    const glowTarget = this.isOn || this.state === 'ringing' ? 1 : 0;
    this.glow += (glowTarget - this.glow) * Math.min(1, dt * 5);
    this.glow = clamp01(this.glow);
  }

  setState(next: string): void {
    this.state = next;
  }
}
