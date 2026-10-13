import { circle, Layer } from '../physics/Collider';
import { FIXED_DT, type ContactListener, type PhysicsWorld } from '../physics/PhysicsWorld';
import { copyMotion, createBody, type RigidBody } from '../physics/RigidBody';

const MAX_POINTS = 24;
/** One dot every 1/30 s of flight, so the gaps between dots show the pace. */
const STEPS_PER_POINT = 8;

/**
 * A short, honest look ahead: the real physics run on a ghost ball for a fraction of a second.
 * It shows the start of the shot and the first touch, never the whole answer.
 */
export class TrajectoryPreview {
  readonly points = new Float32Array(MAX_POINTS * 2);
  count = 0;
  hasHit = false;
  hitX = 0;
  hitY = 0;
  hitNx = 0;
  hitNy = 0;

  private readonly ghost: RigidBody;
  private pendingHit = false;
  private readonly onContact: ContactListener = (body, _other, c, impact) => {
    if (this.hasHit || impact < 40) return;
    this.hasHit = true;
    this.pendingHit = true;
    this.hitX = body.x;
    this.hitY = body.y;
    this.hitNx = c.nx;
    this.hitNy = c.ny;
  };

  constructor(radius: number) {
    this.ghost = createBody({ shape: circle(radius), surface: 'ball', x: 0, y: 0, isStatic: false, layer: Layer.Ball, mask: Layer.Solid | Layer.Net });
  }

  clear(): void {
    this.count = 0;
    this.hasHit = false;
  }

  /** `field`, when given, is applied to the ghost before every step (the magnet's pull). */
  compute(world: PhysicsWorld, ball: RigidBody, dirX: number, dirY: number, speed: number, power: number, field: ((b: RigidBody) => void) | null = null): void {
    const g = this.ghost;
    copyMotion(ball, g);
    g.vx = dirX * speed;
    g.vy = dirY * speed;
    g.angVel = 0;
    this.count = 0;
    this.hasHit = false;
    this.pendingHit = false;

    const seconds = 0.3 + 0.24 * power;
    const steps = Math.round(seconds / FIXED_DT);
    // After the first touch, show only a stub of the rebound.
    let afterHit = Math.round(0.11 / FIXED_DT);
    for (let i = 1; i <= steps; i++) {
      if (field) field(g);
      world.stepBody(g, FIXED_DT, this.onContact);
      if (this.hasHit && --afterHit <= 0) break;
      if ((i % STEPS_PER_POINT === 0 || this.pendingHit) && this.count < MAX_POINTS) {
        this.pendingHit = false;
        this.points[this.count * 2] = g.x;
        this.points[this.count * 2 + 1] = g.y;
        this.count++;
      }
    }
  }
}
