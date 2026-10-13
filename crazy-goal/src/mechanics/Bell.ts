import { box, circle, Layer } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

export const BELL_RADIUS = 22;

/**
 * A doorbell on a post and the shutter it opens. The shutter is solid until the ball rings
 * the bell, then rolls up for the rest of the shot: one shot has to do both jobs.
 */
export class Bell extends Mechanic {
  readonly bell: RigidBody;
  readonly gate: RigidBody;
  rung = false;
  /** 0 shut, 1 fully rolled up. */
  open = 0;
  /** 1 as it is struck, easing to 0: the bell's swing. */
  swing = 0;

  constructor(
    readonly def: { x: number; y: number; gate: { x: number; y: number; w: number; h: number } },
    world: PhysicsWorld,
  ) {
    super();
    this.bell = world.addStatic(createBody({ shape: circle(BELL_RADIUS), surface: 'bell', x: def.x, y: def.y, restitution: 0.85, friction: 0.05 }));
    const g = def.gate;
    this.gate = world.addStatic(createBody({ shape: box(g.w, g.h), surface: 'gate', x: g.x, y: g.y, restitution: 0.7, friction: 0.1 }));
    this.bodies.push(this.bell, this.gate);
    this.sortY = def.y;
  }

  override reset(): void {
    this.rung = false;
    this.open = 0;
    this.gate.layer = Layer.Solid;
  }

  /** The shutter burns; the bell on its post just rings. */
  override burnable(body: RigidBody): boolean {
    return body === this.gate && !this.rung;
  }

  override burn(): void {
    this.rung = true;
    this.gate.layer = 0;
  }

  override contact(other: RigidBody, impact: number, _ball: RigidBody, sink: MechSink | null): void {
    if (other !== this.bell || impact < 40) return;
    this.swing = 1;
    if (this.rung) return;
    this.rung = true;
    this.gate.layer = 0;
    sink?.({ kind: 'bell', x: this.def.x, y: this.def.y, strength: Math.min(1, impact / 1000) });
  }

  override tick(dt: number): void {
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 1.6);
    this.open = this.rung ? Math.min(1, this.open + dt * 3.5) : 0;
  }
}
