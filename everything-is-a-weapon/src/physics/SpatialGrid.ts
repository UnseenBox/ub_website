import type { RigidBody } from './RigidBody';

/**
 * Uniform grid broad phase. Cell arrays are reused between steps, so a rebuild
 * allocates nothing once the room has warmed up.
 */
export class SpatialGrid {
  cols = 1;
  rows = 1;
  private originX = 0;
  private originY = 0;
  private cells: RigidBody[][] = [[]];
  private queryStamp = 1;

  constructor(readonly cellSize: number) {}

  resize(x0: number, y0: number, x1: number, y1: number): void {
    this.originX = x0;
    this.originY = y0;
    this.cols = Math.max(1, Math.ceil((x1 - x0) / this.cellSize));
    this.rows = Math.max(1, Math.ceil((y1 - y0) / this.cellSize));
    const count = this.cols * this.rows;
    this.cells = [];
    for (let i = 0; i < count; i++) this.cells.push([]);
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) this.cells[i]!.length = 0;
  }

  private col(x: number): number {
    const c = Math.floor((x - this.originX) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private row(y: number): number {
    const r = Math.floor((y - this.originY) / this.cellSize);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }

  insert(body: RigidBody): void {
    const c0 = this.col(body.x - body.extX);
    const c1 = this.col(body.x + body.extX);
    const r0 = this.row(body.y - body.extY);
    const r1 = this.row(body.y + body.extY);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) this.cells[r * this.cols + c]!.push(body);
    }
  }

  /** Visits every distinct body whose cells overlap the given box. */
  forEachInBox(
    x: number,
    y: number,
    halfW: number,
    halfH: number,
    visit: (body: RigidBody) => void,
  ): void {
    const stamp = ++this.queryStamp;
    const c0 = this.col(x - halfW);
    const c1 = this.col(x + halfW);
    const r0 = this.row(y - halfH);
    const r1 = this.row(y + halfH);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = this.cells[r * this.cols + c]!;
        for (let i = 0; i < cell.length; i++) {
          const other = cell[i]!;
          if (other.stamp === stamp) continue;
          other.stamp = stamp;
          visit(other);
        }
      }
    }
  }

  /** Candidate collection used by the pair finder; `out` is filled without duplicates. */
  collect(body: RigidBody, out: RigidBody[]): void {
    out.length = 0;
    const stamp = ++this.queryStamp;
    body.stamp = stamp;
    const c0 = this.col(body.x - body.extX);
    const c1 = this.col(body.x + body.extX);
    const r0 = this.row(body.y - body.extY);
    const r1 = this.row(body.y + body.extY);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = this.cells[r * this.cols + c]!;
        for (let i = 0; i < cell.length; i++) {
          const other = cell[i]!;
          if (other.stamp === stamp) continue;
          other.stamp = stamp;
          out.push(other);
        }
      }
    }
  }
}
