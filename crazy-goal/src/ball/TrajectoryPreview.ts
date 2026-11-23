import type { Level } from '../levels/Level';
import { circle, Layer } from '../physics/Collider';
import { FIXED_DT, type ContactListener } from '../physics/PhysicsWorld';
import { launchVz } from '../physics/Flight';
import { copyMotion, createBody, type RigidBody } from '../physics/RigidBody';

const MAX_POINTS = 64;
/** One dot every 1/30 s of flight, so the gaps between dots show the pace. */
const STEPS_PER_POINT = 8;

/**
 * A short, honest look ahead: the real physics run on a ghost ball for a fraction of a second.
 * It shows the start of the shot and the first touch, never the whole answer.
 */
export class TrajectoryPreview {
  readonly points = new Float32Array(MAX_POINTS * 2);
  /** The height of the ball at each dot (a lofted shot), so the dots can float above their shadow. */
  readonly zs = new Float32Array(MAX_POINTS);
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
  compute(level: Level, ball: RigidBody, dirX: number, dirY: number, speed: number, power: number, field: ((b: RigidBody) => void) | null = null, kick: { air: boolean; bend: number } = { air: false, bend: 0 }, full = false, reach = 1): void {
    const g = this.ghost;
    const world = level.world;
    copyMotion(ball, g);
    g.vx = dirX * speed;
    g.vy = dirY * speed;
    g.angVel = 0;
    g.z = kick.air ? 0.01 : 0;
    g.vz = kick.air ? launchVz(power) : 0;
    g.bend = kick.bend;
    g.turned = 0;
    this.count = 0;
    this.hasHit = false;
    this.pendingHit = false;

    // A lofted shot is shown all the way to where it comes down; a ground shot only to its first touch.
    // `full` (the lesson's dotted path) follows the whole shot, bounces included, until it is in the goal or has stopped.
    // `reach` is the store's AIM GUIDE upgrade: the line runs on further.
    const seconds = full ? 2.1 : (kick.air ? 1.25 : 0.3 + 0.24 * power) * reach;
    const steps = Math.round(seconds / FIXED_DT);
    // After the first touch, show only a stub of the rebound.
    let afterHit = Math.round(0.11 / FIXED_DT);
    for (let i = 1; i <= steps; i++) {
      level.applyFields(g, FIXED_DT);
      if (field) field(g);
      world.stepBody(g, FIXED_DT, this.onContact);
      // A lofted shot that has come back down has shown all there is.
      if (kick.air && !full && g.z <= 0 && i > 20) break;
      if (full && (level.goal.contains(g.x, g.y) || (i > 30 && g.z <= 0 && Math.hypot(g.vx, g.vy) < 20))) break;
      if (!full && this.hasHit && --afterHit <= 0) break;
      if ((i % STEPS_PER_POINT === 0 || this.pendingHit) && this.count < MAX_POINTS) {
        this.pendingHit = false;
        this.points[this.count * 2] = g.x;
        this.points[this.count * 2 + 1] = g.y;
        this.zs[this.count] = g.z;
        this.count++;
      }
    }
  }
}
