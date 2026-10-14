import type { Entity } from '../core/types';

export type BodyType = 'static' | 'dynamic' | 'kinematic';

export const Layer = {
  Wall: 1,
  Object: 2,
  Player: 4,
  Enemy: 8,
  Debris: 16,
} as const;

export const MASK_ALL = 0xffff;

export interface CircleShape {
  readonly kind: 'circle';
  readonly r: number;
}

export interface BoxShape {
  readonly kind: 'box';
  readonly hw: number;
  readonly hh: number;
}

/** A box with angle 0 and fixedRotation is the axis-aligned case; otherwise it is oriented. */
export type Shape = CircleShape | BoxShape;

export interface BodyOptions {
  type?: BodyType;
  shape: Shape;
  x: number;
  y: number;
  angle?: number;
  mass?: number;
  friction?: number;
  restitution?: number;
  groundFriction?: number;
  linearDrag?: number;
  angularDrag?: number;
  layer?: number;
  mask?: number;
  fixedRotation?: boolean;
  isTrigger?: boolean;
  canSleep?: boolean;
}

let nextBodyId = 1;

export class RigidBody {
  readonly id = nextBodyId++;
  type: BodyType;
  shape!: Shape;

  x: number;
  y: number;
  angle: number;
  prevX: number;
  prevY: number;
  prevAngle: number;

  vx = 0;
  vy = 0;
  /** Angular velocity, rad/s. */
  w = 0;
  /** Accumulated force for this step (acceleration = force * invMass). */
  fx = 0;
  fy = 0;

  /** Height above the floor and its velocity. Cosmetic axis: bodies still collide in the plane. */
  z = 0;
  prevZ = 0;
  vz = 0;

  mass = 1;
  invMass = 1;
  inertia = 1;
  invInertia = 1;

  /** Surface friction used in contacts. */
  friction: number;
  restitution: number;
  /** Top-down floor friction as a constant deceleration, px/s². */
  groundFriction: number;
  linearDrag: number;
  angularDrag: number;

  layer: number;
  mask: number;
  fixedRotation: boolean;
  /** Trigger bodies report overlaps but are never resolved. */
  isTrigger: boolean;

  canSleep: boolean;
  sleeping = false;
  sleepTimer = 0;

  /** Temporarily ignore collisions with one other body (e.g. the thrower). */
  ignoreId = 0;
  ignoreTimer = 0;

  boundR = 1;
  /** World-space half extents of the AABB, refreshed each step. */
  extX = 1;
  extY = 1;

  owner: Entity | null = null;
  /** Scratch value for broad-phase de-duplication. */
  stamp = 0;

  constructor(options: BodyOptions) {
    this.type = options.type ?? 'dynamic';
    this.x = this.prevX = options.x;
    this.y = this.prevY = options.y;
    this.angle = this.prevAngle = options.angle ?? 0;
    this.friction = options.friction ?? 0.4;
    this.restitution = options.restitution ?? 0.2;
    this.groundFriction = options.groundFriction ?? 900;
    this.linearDrag = options.linearDrag ?? 0.3;
    this.angularDrag = options.angularDrag ?? 3.5;
    this.layer = options.layer ?? Layer.Object;
    this.mask = options.mask ?? MASK_ALL;
    this.fixedRotation = options.fixedRotation ?? false;
    this.isTrigger = options.isTrigger ?? false;
    this.canSleep = options.canSleep ?? true;
    this.mass = options.mass ?? 1;
    this.setShape(options.shape);
  }

  setShape(shape: Shape): void {
    this.shape = shape;
    this.boundR = shape.kind === 'circle' ? shape.r : Math.hypot(shape.hw, shape.hh);
    this.setMass(this.mass);
    this.updateExtents();
  }

  setMass(mass: number): void {
    this.mass = mass;
    if (this.type !== 'dynamic' || mass <= 0) {
      this.invMass = 0;
      this.invInertia = 0;
      return;
    }
    this.invMass = 1 / mass;
    const s = this.shape;
    this.inertia =
      s.kind === 'circle' ? 0.5 * mass * s.r * s.r : (mass * (4 * s.hw * s.hw + 4 * s.hh * s.hh)) / 12;
    this.invInertia = this.fixedRotation || this.inertia <= 0 ? 0 : 1 / this.inertia;
  }

  updateExtents(): void {
    const s = this.shape;
    if (s.kind === 'circle') {
      this.extX = this.extY = s.r;
      return;
    }
    const c = Math.abs(Math.cos(this.angle));
    const sn = Math.abs(Math.sin(this.angle));
    this.extX = c * s.hw + sn * s.hh;
    this.extY = sn * s.hw + c * s.hh;
  }

  wake(): void {
    this.sleeping = false;
    this.sleepTimer = 0;
  }

  applyImpulse(ix: number, iy: number): void {
    if (this.invMass === 0) return;
    this.vx += ix * this.invMass;
    this.vy += iy * this.invMass;
    this.wake();
  }

  speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  /** Snap without leaving an interpolation streak behind. */
  teleport(x: number, y: number, angle = this.angle): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.angle = this.prevAngle = angle;
    this.updateExtents();
  }

  containsPoint(px: number, py: number, margin = 0): boolean {
    const s = this.shape;
    const dx = px - this.x;
    const dy = py - this.y;
    if (s.kind === 'circle') {
      const r = s.r + margin;
      return dx * dx + dy * dy <= r * r;
    }
    const c = Math.cos(this.angle);
    const sn = Math.sin(this.angle);
    const lx = dx * c + dy * sn;
    const ly = -dx * sn + dy * c;
    return Math.abs(lx) <= s.hw + margin && Math.abs(ly) <= s.hh + margin;
  }
}
