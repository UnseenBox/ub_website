import type { Game } from '../core/Game';

const CELL = 36;
const BLOCKED = 255;
const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42],
];

/**
 * Shared flow field: one Dijkstra pass outward from the player, and every enemy simply
 * walks downhill. Heavy furniture blocks cells, light clutter and visible hazards add cost,
 * so intruders path around a table but will happily shove a chair out of the way.
 */
export class NavField {
  private cols = 1;
  private rows = 1;
  private cost = new Uint8Array(1);
  private distance = new Float32Array(1);
  private heap: number[] = [];
  private timer = 0;

  resize(width: number, height: number): void {
    this.cols = Math.max(1, Math.ceil(width / CELL));
    this.rows = Math.max(1, Math.ceil(height / CELL));
    this.cost = new Uint8Array(this.cols * this.rows);
    this.distance = new Float32Array(this.cols * this.rows);
    this.timer = 0;
  }

  update(game: Game, dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.2;
    this.rebuild(game);
  }

  private mark(x: number, y: number, halfW: number, halfH: number, value: number): void {
    const c0 = Math.max(0, Math.floor((x - halfW) / CELL));
    const c1 = Math.min(this.cols - 1, Math.floor((x + halfW) / CELL));
    const r0 = Math.max(0, Math.floor((y - halfH) / CELL));
    const r1 = Math.min(this.rows - 1, Math.floor((y + halfH) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        if (value === BLOCKED) this.cost[i] = BLOCKED;
        else if (this.cost[i]! !== BLOCKED) this.cost[i] = Math.min(250, this.cost[i]! + value);
      }
    }
  }

  private rebuild(game: Game): void {
    this.cost.fill(1);
    for (const object of game.objects) {
      if (!object.alive || object.held) continue;
      const b = object.body;
      if (b.mass >= 35) this.mark(b.x, b.y, Math.max(4, b.extX - 6), Math.max(4, b.extY - 6), BLOCKED);
      else if (b.mass >= 4) this.mark(b.x, b.y, b.extX * 0.5, b.extY * 0.5, 3);
    }
    for (const zone of game.zones.zones) {
      if (!zone.alive || zone.attached) continue;
      if (zone.zone === 'fire') this.mark(zone.x, zone.y, zone.r * 0.8, zone.r * 0.8, 14);
      else if (zone.zone === 'glass') this.mark(zone.x, zone.y, zone.r * 0.6, zone.r * 0.6, 3);
    }

    this.distance.fill(Infinity);
    const pc = Math.min(this.cols - 1, Math.max(0, Math.floor(game.player.body.x / CELL)));
    const pr = Math.min(this.rows - 1, Math.max(0, Math.floor(game.player.body.y / CELL)));
    const start = pr * this.cols + pc;
    this.distance[start] = 0;
    const heap = this.heap;
    heap.length = 0;
    this.push(start);

    while (heap.length > 0) {
      const current = this.pop();
      const cd = this.distance[current]!;
      const cc = current % this.cols;
      const cr = (current - cc) / this.cols;
      for (let n = 0; n < NEIGHBOURS.length; n++) {
        const [dx, dy, step] = NEIGHBOURS[n]!;
        const nc = cc + dx;
        const nr = cr + dy;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const ni = nr * this.cols + nc;
        const cellCost = this.cost[ni]!;
        if (cellCost === BLOCKED) continue;
        // No squeezing diagonally between two blocked cells.
        if (dx !== 0 && dy !== 0) {
          if (this.cost[cr * this.cols + nc]! === BLOCKED || this.cost[nr * this.cols + cc]! === BLOCKED) continue;
        }
        const nd = cd + step * cellCost;
        if (nd < this.distance[ni]!) {
          this.distance[ni] = nd;
          this.push(ni);
        }
      }
    }
  }

  private push(index: number): void {
    const heap = this.heap;
    const d = this.distance;
    let i = heap.length;
    heap.push(index);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (d[heap[parent]!]! <= d[heap[i]!]!) break;
      const tmp = heap[parent]!;
      heap[parent] = heap[i]!;
      heap[i] = tmp;
      i = parent;
    }
  }

  private pop(): number {
    const heap = this.heap;
    const d = this.distance;
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && d[heap[l]!]! < d[heap[smallest]!]!) smallest = l;
        if (r < heap.length && d[heap[r]!]! < d[heap[smallest]!]!) smallest = r;
        if (smallest === i) break;
        const tmp = heap[smallest]!;
        heap[smallest] = heap[i]!;
        heap[i] = tmp;
        i = smallest;
      }
    }
    return top;
  }

  /** Writes the unit direction towards the player along the field. False if there is no known path. */
  direction(x: number, y: number, out: { x: number; y: number }): boolean {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x / CELL)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor(y / CELL)));
    let best = this.distance[r * this.cols + c]!;
    let bc = -1;
    let br = -1;
    for (let n = 0; n < NEIGHBOURS.length; n++) {
      const [dx, dy] = NEIGHBOURS[n]!;
      const nc = c + dx;
      const nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
      if (dx !== 0 && dy !== 0) {
        if (this.cost[r * this.cols + nc]! === BLOCKED || this.cost[nr * this.cols + c]! === BLOCKED) continue;
      }
      const d = this.distance[nr * this.cols + nc]!;
      if (d < best) {
        best = d;
        bc = nc;
        br = nr;
      }
    }
    if (bc < 0) return false;
    const tx = (bc + 0.5) * CELL - x;
    const ty = (br + 0.5) * CELL - y;
    const len = Math.hypot(tx, ty) || 1;
    out.x = tx / len;
    out.y = ty / len;
    return true;
  }

  /** Debug drawing support. */
  forEachBlocked(visit: (x: number, y: number, size: number) => void): void {
    for (let i = 0; i < this.cost.length; i++) {
      if (this.cost[i] !== BLOCKED) continue;
      const c = i % this.cols;
      visit(c * CELL, ((i - c) / this.cols) * CELL, CELL);
    }
  }
}
