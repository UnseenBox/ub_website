import { clamp } from '../core/math';
import { circle, Layer } from '../physics/Collider';
import { createBody, type RigidBody } from '../physics/RigidBody';

/** Tuning for how the ball carries. Distances are world units; the pitch is 1000 wide. */
export const BALL_TUNING = {
  radius: 18,
  /** Proportional slowdown per second. */
  drag: 0.42,
  /** Fixed slowdown in units per second squared: what makes a slow ball stop instead of creeping. */
  rollResistance: 220,
  spinDrag: 1.4,
  maxSpeed: 2600,
  /** The patches turn slower than true rolling would; at full speed real rolling just strobes. */
  rollVisual: 0.42,
} as const;

const PATCHES = 12;
const SQUASH_STIFFNESS = 1500;
const SQUASH_DAMPING = 26;

/** The football: a physics body plus everything that makes it read as a rolling, squashy sphere. */
export class Ball {
  readonly radius = BALL_TUNING.radius;
  readonly body: RigidBody;

  /** Position before the latest physics step, and the blend of the two that gets drawn. */
  prevX: number;
  prevY: number;
  renderX: number;
  renderY: number;

  /**
   * Orientation as points on a unit sphere: for each of the 12 pentagon patches, its centre
   * and one tangent. x is right, y is down the screen, z points away from the camera, so the
   * face we see is z < 0.
   */
  readonly patches = new Float32Array(PATCHES * 6);

  /** Spring-driven deformation along `squashAngle`: negative is flattened, positive is stretched. */
  squash = 0;
  squashAngle = 0;
  private squashVel = 0;
  /** 0 to 1 pop-in after a reset. */
  spawn = 1;

  constructor(x: number, y: number) {
    this.body = createBody({
      shape: circle(this.radius),
      surface: 'ball',
      x,
      y,
      isStatic: false,
      layer: Layer.Ball,
      mask: Layer.Solid | Layer.Net,
      restitution: 1,
      drag: BALL_TUNING.drag,
      rollResistance: BALL_TUNING.rollResistance,
      spinDrag: BALL_TUNING.spinDrag,
      maxSpeed: BALL_TUNING.maxSpeed,
    });
    this.prevX = this.renderX = x;
    this.prevY = this.renderY = y;
    this.seedPatches();
  }

  get speed(): number {
    return Math.hypot(this.body.vx, this.body.vy);
  }

  reset(x: number, y: number): void {
    const b = this.body;
    b.x = x;
    b.y = y;
    b.vx = 0;
    b.vy = 0;
    b.angVel = 0;
    b.drag = BALL_TUNING.drag;
    b.rollResistance = BALL_TUNING.rollResistance;
    this.prevX = this.renderX = x;
    this.prevY = this.renderY = y;
    this.squash = 0;
    this.squashVel = 0;
    this.spawn = 0;
  }

  savePrev(): void {
    this.prevX = this.body.x;
    this.prevY = this.body.y;
  }

  /** `alpha` is how far the frame sits between the last two physics steps. */
  interpolate(alpha: number): void {
    this.renderX = this.prevX + (this.body.x - this.prevX) * alpha;
    this.renderY = this.prevY + (this.body.y - this.prevY) * alpha;
  }

  /** Flatten against a surface. `strength` is 0 to 1. */
  impact(nx: number, ny: number, strength: number): void {
    this.squashAngle = Math.atan2(ny, nx);
    this.squash = Math.min(this.squash, 0);
    this.squashVel = -(4 + 15 * strength);
  }

  /** Stretch along a direction, as the ball leaves the boot. */
  stretch(dx: number, dy: number, amount: number): void {
    this.squashAngle = Math.atan2(dy, dx);
    this.squash = amount;
    this.squashVel = 0;
  }

  update(dt: number): void {
    if (this.spawn < 1) this.spawn = Math.min(1, this.spawn + dt / 0.22);

    // Damped spring back to round, with enough bounce to wobble once.
    const acc = -SQUASH_STIFFNESS * this.squash - SQUASH_DAMPING * this.squashVel;
    this.squashVel += acc * dt;
    this.squash = clamp(this.squash + this.squashVel * dt, -0.42, 0.3);

    this.roll(dt);
  }

  private roll(dt: number): void {
    const b = this.body;
    // Rolling without slipping on the ground plane, plus spin about the vertical axis.
    const k = BALL_TUNING.rollVisual / this.radius;
    const wx = b.vy * k;
    const wy = -b.vx * k;
    const wz = b.angVel * 0.5;
    const w = Math.sqrt(wx * wx + wy * wy + wz * wz);
    if (w < 1e-4) return;
    const ax = wx / w;
    const ay = wy / w;
    const az = wz / w;
    const theta = w * dt;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const p = this.patches;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i];
      const y = p[i + 1];
      const z = p[i + 2];
      // Rodrigues' rotation about the unit axis (ax, ay, az).
      const dot = (ax * x + ay * y + az * z) * (1 - c);
      p[i] = x * c + (ay * z - az * y) * s + ax * dot;
      p[i + 1] = y * c + (az * x - ax * z) * s + ay * dot;
      p[i + 2] = z * c + (ax * y - ay * x) * s + az * dot;
    }
  }

  /** Pentagon centres of a classic football sit on the 12 vertices of an icosahedron. */
  private seedPatches(): void {
    const phi = (1 + Math.sqrt(5)) / 2;
    const verts: Array<[number, number, number]> = [];
    for (const a of [-1, 1]) {
      for (const b of [-phi, phi]) {
        verts.push([0, a, b], [a, b, 0], [b, 0, a]);
      }
    }
    // Tilt the whole pattern so no patch starts dead centre or perfectly symmetric.
    const tilt = 0.55;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    verts.forEach(([vx, vy, vz], i) => {
      const len = Math.hypot(vx, vy, vz);
      let x = vx / len;
      let y = vy / len;
      let z = vz / len;
      const y2 = y * ct - z * st;
      z = y * st + z * ct;
      y = y2;
      const x2 = x * ct + z * st;
      z = -x * st + z * ct;
      x = x2;
      // Any vector not parallel to the centre gives a tangent via the cross product.
      const rx = Math.abs(z) < 0.9 ? 0 : 1;
      const rz = Math.abs(z) < 0.9 ? 1 : 0;
      let tx = y * rz;
      let ty = z * rx - x * rz;
      let tz = -y * rx;
      const tl = Math.hypot(tx, ty, tz);
      tx /= tl;
      ty /= tl;
      tz /= tl;
      this.patches.set([x, y, z, tx, ty, tz], i * 6);
    });
  }
}
