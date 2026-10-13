import type { RigidBody } from './RigidBody';
import { halfExtents } from './RigidBody';

/** Uniform grid broad phase for static bodies. */
export class SpatialGrid {
  private readonly cells = new Map<number, RigidBody[]>();
  private stamp = 0;

  constructor(private readonly cellSize: number) {}

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number): number {
    return (cx + 4096) * 8192 + (cy + 4096);
  }

  insert(b: RigidBody): void {
    const { hx, hy } = halfExtents(b);
    const x0 = Math.floor((b.x - hx) / this.cellSize);
    const x1 = Math.floor((b.x + hx) / this.cellSize);
    const y0 = Math.floor((b.y - hy) / this.cellSize);
    const y1 = Math.floor((b.y + hy) / this.cellSize);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy);
        const cell = this.cells.get(k);
        if (cell) cell.push(b);
        else this.cells.set(k, [b]);
      }
    }
  }

  /** Writes each body overlapping the box once into `out`; returns how many. */
  query(minX: number, minY: number, maxX: number, maxY: number, out: RigidBody[]): number {
    const stamp = ++this.stamp;
    let n = 0;
    const x0 = Math.floor(minX / this.cellSize);
    const x1 = Math.floor(maxX / this.cellSize);
    const y0 = Math.floor(minY / this.cellSize);
    const y1 = Math.floor(maxY / this.cellSize);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const b = cell[i];
          if (b.stamp === stamp) continue;
          b.stamp = stamp;
          out[n++] = b;
        }
      }
    }
    return n;
  }
}
