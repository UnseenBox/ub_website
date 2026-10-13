import { smoothstep } from '../core/math';

const LENGTH = 16;

/** Ring buffer of recent ball positions, drawn as a tapering ribbon when the ball is quick. */
export class BallTrail {
  readonly length = LENGTH;
  readonly xs = new Float32Array(LENGTH);
  readonly ys = new Float32Array(LENGTH);
  /** 0 to 1: how visible the trail was when that sample was taken. */
  readonly strength = new Float32Array(LENGTH);
  private head = 0;
  count = 0;

  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  push(x: number, y: number, speed: number): void {
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.strength[this.head] = smoothstep(380, 1300, speed);
    this.head = (this.head + 1) % LENGTH;
    if (this.count < LENGTH) this.count++;
  }

  /** Index of the i-th sample, oldest first. */
  index(i: number): number {
    return (this.head - this.count + i + LENGTH * 2) % LENGTH;
  }
}
