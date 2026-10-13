import { clamp } from '../core/math';
import type { Goal } from '../goal/Goal';
import { circle } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

export const CAT_RADIUS = 27;
/** How far in front of the goal line she sits. */
const STAND_OFF = 58;
/** Seconds between the ball heading her way and her starting to move. */
const REACTION = 0.24;
const ACCELERATION = 1500;

/**
 * Mimi, the goalkeeper. She plays fair: she sees only what the player sees. She watches the
 * ball's current line and runs to where that line crosses hers, at a limited speed and after
 * a moment's reaction. She cannot read a bank before it happens, which is how you beat her.
 */
export class Cat extends Mechanic {
  readonly body: RigidBody;
  /** -1 to 1: which way she is leaning, for drawing. */
  lean = 0;
  /** 1 as she blocks a shot, easing to 0. */
  pounce = 0;
  private readonly homeX: number;
  private readonly minX: number;
  private readonly maxX: number;
  private alert = 0;
  private idle = 0;
  private saved = false;

  constructor(
    private readonly def: { speed: number },
    world: PhysicsWorld,
    goal: Goal,
  ) {
    super();
    this.homeX = goal.cx;
    this.minX = goal.cx - goal.width / 2 + 6;
    this.maxX = goal.cx + goal.width / 2 - 6;
    this.body = world.addMover(createBody({ shape: circle(CAT_RADIUS), surface: 'cat', x: goal.cx, y: goal.lineY + STAND_OFF, restitution: 0.3, friction: 0.3 }));
    this.bodies.push(this.body);
    this.sortY = this.body.y;
  }

  override reset(): void {
    this.saved = false;
    this.alert = 0;
  }

  override move(dt: number, ball: RigidBody, live: boolean): void {
    const b = this.body;
    this.idle += dt;
    // Between shots she pads about in front of the goal.
    let target = this.homeX + Math.sin(this.idle * 0.9) * 46;
    let top = this.def.speed * 0.3;

    const coming = live && ball.vy < -70 && ball.y > b.y + 10;
    if (coming) {
      this.alert += dt;
      if (this.alert >= REACTION) {
        const t = (b.y - ball.y) / ball.vy;
        target = ball.x + ball.vx * t;
        top = this.def.speed;
      }
    } else {
      this.alert = 0;
    }

    target = clamp(target, this.minX, this.maxX);
    const want = clamp((target - b.x) * 9, -top, top);
    b.vx += clamp(want - b.vx, -ACCELERATION * dt, ACCELERATION * dt);
    b.x += b.vx * dt;
    if (b.x < this.minX || b.x > this.maxX) {
      b.x = clamp(b.x, this.minX, this.maxX);
      b.vx = 0;
    }
    this.lean = clamp(b.vx / this.def.speed, -1, 1);
  }

  override contact(_other: RigidBody, impact: number, ball: RigidBody, sink: MechSink | null): void {
    if (impact < 60) return;
    this.pounce = 1;
    if (this.saved) return;
    this.saved = true;
    sink?.({ kind: 'save', x: ball.x, y: ball.y, strength: Math.min(1, impact / 1200) });
  }

  override tick(dt: number): void {
    if (this.pounce > 0) this.pounce = Math.max(0, this.pounce - dt * 2.2);
  }
}
