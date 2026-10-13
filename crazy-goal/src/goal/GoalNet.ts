import { clamp, lerp } from '../core/math';
import type { Goal } from './Goal';

const STIFFNESS = 150;
const DAMPING = 4.6;
const COUPLING = 520;
const MAX_VEL = 620;

/**
 * The net is a small grid of spring-loaded points. It is purely visual: the ball is stopped
 * by the net colliders, and each touch punches this grid so the mesh billows and ripples.
 */
export class GoalNet {
  readonly cols = 17;
  readonly rows = 7;
  readonly restX: Float32Array;
  readonly restY: Float32Array;
  /** Displacement of each node from its rest position. */
  readonly ox: Float32Array;
  readonly oy: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly fx: Float32Array;
  private readonly fy: Float32Array;
  /** Skips the simulation while the net hangs still. */
  private energy = 0;

  constructor(goal: Goal) {
    const n = this.cols * this.rows;
    this.restX = new Float32Array(n);
    this.restY = new Float32Array(n);
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.fx = new Float32Array(n);
    this.fy = new Float32Array(n);

    const frontY = goal.barY;
    const backY = goal.backTopY;
    for (let j = 0; j < this.rows; j++) {
      const v = j / (this.rows - 1);
      const left = goal.leftPostX + goal.taper * v;
      const right = goal.rightPostX - goal.taper * v;
      for (let i = 0; i < this.cols; i++) {
        const u = i / (this.cols - 1);
        const k = j * this.cols + i;
        this.restX[k] = lerp(left, right, u);
        // A little sag in the middle of the roof.
        this.restY[k] = lerp(frontY, backY, v) + Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 5;
      }
    }
  }

  /** Hits the net around world x with a velocity. Deeper rows move more: they hang free. */
  punch(x: number, vx: number, vy: number): void {
    for (let j = 1; j < this.rows; j++) {
      const depth = j / (this.rows - 1);
      const give = 0.2 + 0.8 * depth * depth;
      for (let i = 1; i < this.cols - 1; i++) {
        const k = j * this.cols + i;
        const d = (this.restX[k] - x) / 62;
        const w = Math.exp(-d * d) * give;
        this.vx[k] = clamp(this.vx[k] + vx * w, -MAX_VEL, MAX_VEL);
        this.vy[k] = clamp(this.vy[k] + vy * w, -MAX_VEL, MAX_VEL);
      }
    }
    this.energy = 1;
  }

  update(dt: number): void {
    if (this.energy <= 0) return;
    const step = Math.min(dt, 1 / 60);
    const { cols, rows, ox, oy, vx, vy, fx, fy } = this;
    let total = 0;
    // The front row hangs from the crossbar and the side columns from the side bars: both fixed.
    for (let j = 1; j < rows; j++) {
      for (let i = 1; i < cols - 1; i++) {
        const k = j * cols + i;
        const down = j < rows - 1 ? k + cols : k;
        const ax = (ox[k - 1] + ox[k + 1] + ox[k - cols] + ox[down]) * 0.25;
        const ay = (oy[k - 1] + oy[k + 1] + oy[k - cols] + oy[down]) * 0.25;
        fx[k] = -STIFFNESS * ox[k] - DAMPING * vx[k] + COUPLING * (ax - ox[k]);
        fy[k] = -STIFFNESS * oy[k] - DAMPING * vy[k] + COUPLING * (ay - oy[k]);
      }
    }
    for (let j = 1; j < rows; j++) {
      for (let i = 1; i < cols - 1; i++) {
        const k = j * cols + i;
        vx[k] += fx[k] * step;
        vy[k] += fy[k] * step;
        ox[k] += vx[k] * step;
        oy[k] += vy[k] * step;
        total += Math.abs(vx[k]) + Math.abs(vy[k]) + Math.abs(ox[k]) + Math.abs(oy[k]);
      }
    }
    if (total < 2) this.rest();
  }

  rest(): void {
    this.ox.fill(0);
    this.oy.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.energy = 0;
  }
}
