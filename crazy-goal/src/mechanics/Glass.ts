import { box, Layer } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink, type StepInfo } from './Mechanic';

export const GLASS_THICKNESS = 14;
/** Closing speed needed to go through instead of bouncing off. */
export const SMASH_SPEED = 620;
/** Share of its pace the ball keeps after breaking the pane. */
const KEEP = 0.58;

/** A pane of glass on its way to a window. A soft shot bounces off; a hard one goes through. */
export class Glass extends Mechanic {
  readonly body: RigidBody;
  broken = false;
  private pending = false;

  constructor(
    readonly def: { x: number; y: number; w: number; angle?: number },
    world: PhysicsWorld,
  ) {
    super();
    this.body = world.addStatic(createBody({ shape: box(def.w, GLASS_THICKNESS), surface: 'glass', x: def.x, y: def.y, angle: def.angle ?? 0, restitution: 0.5, friction: 0.05 }));
    this.bodies.push(this.body);
    this.sortY = def.y;
  }

  override reset(): void {
    this.broken = false;
    this.pending = false;
    this.body.layer = Layer.Solid;
  }

  override burnable(): boolean {
    return !this.broken;
  }

  override burn(): void {
    this.broken = true;
    this.pending = false;
    this.body.layer = 0;
  }

  override contact(_other: RigidBody, impact: number, ball: RigidBody, sink: MechSink | null): void {
    if (impact >= SMASH_SPEED) this.pending = true;
    else if (impact > 60) sink?.({ kind: 'clink', x: ball.x, y: ball.y, strength: impact / SMASH_SPEED });
  }

  override after(ball: RigidBody, info: StepInfo, sink: MechSink | null): void {
    if (!this.pending) return;
    this.pending = false;
    this.broken = true;
    // Layer 0 collides with nothing: the pane is gone for the rest of the shot.
    this.body.layer = 0;
    // The physics already bounced the ball. Put it back on its way, minus what the glass took.
    ball.vx = info.preVX * KEEP;
    ball.vy = info.preVY * KEEP;
    sink?.({ kind: 'smash', x: ball.x, y: ball.y, strength: 1 });
  }
}
