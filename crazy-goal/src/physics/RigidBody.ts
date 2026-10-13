import type { Shape, Surface } from './Collider';
import { Layer } from './Collider';

export interface RigidBody {
  readonly id: number;
  shape: Shape;
  surface: Surface;
  isStatic: boolean;
  layer: number;
  /** Layers this body collides with. */
  mask: number;
  x: number;
  y: number;
  angle: number;
  cos: number;
  sin: number;
  vx: number;
  vy: number;
  /** Acceleration applied this step by fields (fans, magnets); cleared after integration. */
  ax: number;
  ay: number;
  /** Spin about the vertical axis, radians per second. */
  angVel: number;
  mass: number;
  invMass: number;
  restitution: number;
  friction: number;
  /** Linear drag per second (air and turf). */
  drag: number;
  /** Constant rolling deceleration in units per second squared. */
  rollResistance: number;
  spinDrag: number;
  maxSpeed: number;
  /** Scratch value for the broad phase. */
  stamp: number;
}

export interface BodyOptions {
  shape: Shape;
  surface: Surface;
  x: number;
  y: number;
  angle?: number;
  isStatic?: boolean;
  layer?: number;
  mask?: number;
  mass?: number;
  restitution?: number;
  friction?: number;
  drag?: number;
  rollResistance?: number;
  spinDrag?: number;
  maxSpeed?: number;
}

let nextId = 1;

export function createBody(o: BodyOptions): RigidBody {
  const isStatic = o.isStatic ?? true;
  const mass = isStatic ? 0 : (o.mass ?? 1);
  const angle = o.angle ?? 0;
  return {
    id: nextId++,
    shape: o.shape,
    surface: o.surface,
    isStatic,
    layer: o.layer ?? Layer.Solid,
    mask: o.mask ?? 0,
    x: o.x,
    y: o.y,
    angle,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    vx: 0,
    vy: 0,
    ax: 0,
    ay: 0,
    angVel: 0,
    mass,
    invMass: mass > 0 ? 1 / mass : 0,
    restitution: o.restitution ?? 0.8,
    friction: o.friction ?? 0.1,
    drag: o.drag ?? 0,
    rollResistance: o.rollResistance ?? 0,
    spinDrag: o.spinDrag ?? 0,
    maxSpeed: o.maxSpeed ?? 4000,
    stamp: 0,
  };
}

/** Copies the moving state so a ghost body can replay a shot without touching the real one. */
export function copyMotion(from: RigidBody, to: RigidBody): void {
  to.x = from.x;
  to.y = from.y;
  to.vx = from.vx;
  to.vy = from.vy;
  to.ax = 0;
  to.ay = 0;
  to.angVel = from.angVel;
  to.drag = from.drag;
  to.rollResistance = from.rollResistance;
  to.restitution = from.restitution;
  to.maxSpeed = from.maxSpeed;
}

/** Half extents of the world-space bounding box. */
export function halfExtents(b: RigidBody): { hx: number; hy: number } {
  if (b.shape.kind === 'circle') return { hx: b.shape.r, hy: b.shape.r };
  const c = Math.abs(b.cos);
  const s = Math.abs(b.sin);
  return { hx: c * b.shape.hw + s * b.shape.hh, hy: s * b.shape.hw + c * b.shape.hh };
}
