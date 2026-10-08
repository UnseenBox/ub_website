import { VIEW } from '../core/Tuning';
import { PLAYER } from '../core/Tuning';
import { circleRectOverlap, type Rect } from '../core/Mathx';
import { getObjectDef } from './ObjectRegistry';
import type { RoomDefinition } from './Room';

export interface ValidationResult {
  ok: boolean
  ;
  problems: string[];
}

const CELL = 10;

/**
 * Gate every generated room before it is playable.
 *
 * Note what is *not* checked: whether the player can avoid being noticed. In this
 * game creatures never track the body, so any route the body can walk is a route
 * the cursor can be kept away from. Reachability is therefore the real constraint,
 * and pretending otherwise would be theatre.
 */
export function validateRoom(def: RoomDefinition): ValidationResult {
  const problems: string[] = [];
  const solids: Rect[] = [...def.walls];

  for (const spawn of def.objects) {
    const odef = getObjectDef(spawn.kind);
    if (!odef.solid) continue;
    // A door is a puzzle, not a wall: rooms are allowed to gate the way out
    // behind one, so reachability is judged as though every door can be opened.
    if (spawn.kind === 'DOOR') continue;
    const w = spawn.w ?? odef.w;
    const h = spawn.h ?? odef.h;
    solids.push({ x: spawn.x - w * 0.5, y: spawn.y - h * 0.5, w, h });
  }

  const grid = buildGrid(solids);

  const spawnCell = toCell(def.playerSpawn.x, def.playerSpawn.y);
  if (!walkable(grid, spawnCell.cx, spawnCell.cy)) {
    problems.push('player spawn is inside something solid');
  }

  const reachable = floodFill(grid, spawnCell.cx, spawnCell.cy);

  const exit = def.objects.find((o) => getObjectDef(o.kind).isExit);
  if (!exit) {
    problems.push('room has no way out');
  } else if (!reachableNear(grid, reachable, exit.x, exit.y)) {
    problems.push('the way out cannot be walked to');
  }

  // Everything the objective names has to be touchable.
  const required = new Set<string>();
  for (const id of def.objective.items ?? []) required.add(id);
  for (const id of def.objective.switches ?? []) required.add(id);
  for (const o of def.objects) {
    const needed =
      required.has(o.id ?? '') || (o.kind === 'KEY' && required.has('key'));
    if (!needed) continue;
    // A key inside a container is reached by reaching the container.
    const target = o.hiddenIn ? def.objects.find((c) => c.id === o.hiddenIn) ?? o : o;
    if (!reachableNear(grid, reachable, target.x, target.y)) {
      problems.push(`objective object ${o.id ?? o.kind} cannot be reached`);
    }
  }

  for (const e of def.enemies) {
    const cell = toCell(e.x, e.y);
    if (!walkable(grid, cell.cx, cell.cy)) {
      problems.push(`creature at ${Math.round(e.x)},${Math.round(e.y)} is inside a wall`);
    }
    const d = Math.hypot(e.x - def.playerSpawn.x, e.y - def.playerSpawn.y);
    if (d < 110) problems.push('a creature spawns on top of the player');
  }

  return { ok: problems.length === 0, problems };
}

function buildGrid(solids: readonly Rect[]): Uint8Array {
  const cols = Math.ceil(VIEW.width / CELL);
  const rows = Math.ceil(VIEW.height / CELL);
  const grid = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = cx * CELL + CELL * 0.5;
      const y = cy * CELL + CELL * 0.5;
      let blocked = false;
      for (const s of solids) {
        if (circleRectOverlap(x, y, PLAYER.radius * 0.9, s)) {
          blocked = true;
          break;
        }
      }
      grid[cy * cols + cx] = blocked ? 1 : 0;
    }
  }
  return grid;
}

function cols(): number {
  return Math.ceil(VIEW.width / CELL);
}

function rows(): number {
  return Math.ceil(VIEW.height / CELL);
}

function toCell(x: number, y: number): { cx: number; cy: number } {
  return { cx: Math.floor(x / CELL), cy: Math.floor(y / CELL) };
}

function walkable(grid: Uint8Array, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= cols() || cy >= rows()) return false;
  return grid[cy * cols() + cx] === 0;
}

function floodFill(grid: Uint8Array, startX: number, startY: number): Uint8Array {
  const c = cols();
  const r = rows();
  const seen = new Uint8Array(c * r);
  if (!walkable(grid, startX, startY)) return seen;
  const queue: number[] = [startY * c + startX];
  seen[queue[0]] = 1;
  while (queue.length > 0) {
    const idx = queue.pop()!;
    const cx = idx % c;
    const cy = (idx - cx) / c;
    for (let i = 0; i < 4; i++) {
      const nx = cx + (i === 0 ? 1 : i === 1 ? -1 : 0);
      const ny = cy + (i === 2 ? 1 : i === 3 ? -1 : 0);
      if (!walkable(grid, nx, ny)) continue;
      const nIdx = ny * c + nx;
      if (seen[nIdx]) continue;
      seen[nIdx] = 1;
      queue.push(nIdx);
    }
  }
  return seen;
}

/** True when any walkable cell within arm's reach of the point was reached. */
function reachableNear(grid: Uint8Array, seen: Uint8Array, x: number, y: number): boolean {
  const span = Math.ceil(PLAYER.reach / CELL);
  const { cx, cy } = toCell(x, y);
  for (let dy = -span; dy <= span; dy++) {
    for (let dx = -span; dx <= span; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(grid, nx, ny)) continue;
      if (Math.hypot(dx, dy) * CELL > PLAYER.reach + 6) continue;
      if (seen[ny * cols() + nx]) return true;
    }
  }
  return false;
}
