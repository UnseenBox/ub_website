import { profileHalf, type Profile } from '../data/digShapes';
import type { LayerDef } from '../data/layers';
import type { ToolDef } from '../data/tools';

/** Exponent on power / hardness: above 1 punishes under-powered tools. */
const EFFICIENCY_CURVE = 1.4;

export interface WorldConfig {
  readonly width: number;
  readonly surfaceY: number;
  readonly bedrockHeight: number;
  readonly unitsPerMeter: number;
  readonly columnWidth: number;
}

export interface LayerBand {
  index: number;
  layer: LayerDef;
  /** Field y where the layer starts / ends. */
  top: number;
  bottom: number;
}

/** One ellipse-like piece of a swing's hole (a tool's shape is made of one to four of them). */
export interface CraterPart {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  profile: Profile;
}

/** Temporary multipliers on a single swing (a lucky big hole, a blast): 1 means normal. */
export interface DigBoost {
  depth: number;
  width: number;
}

const NO_BOOST: DigBoost = { depth: 1, width: 1 };

export interface DigResult {
  /** The swing hit solid ground and carved a crater. */
  dug: boolean;
  layerIndex: number;
  layer: LayerDef;
  /** 0..1 - how well the tool bites into this ground. */
  efficiency: number;
  floorBefore: number;
  floorAfter: number;
  /** The main bite (the first part), for the scene to aim rocks and effects with. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Every carved part, for the scene to paint with the same numbers. */
  parts: CraterPart[];
}

/**
 * The excavation as a heightmap: one floor height per column. Terrain is never
 * a pile of objects - the scene paints the same carved ellipses into a single
 * texture, and this class remembers how deep each column has been dug.
 *
 * Digging always acts on the exposed floor, so progress is strictly top-down.
 */
export class ExcavationSystem {
  readonly bands: LayerBand[] = [];
  readonly width: number;
  readonly surfaceY: number;
  /** Deepest y that can be dug. Below it lies bedrock. */
  readonly floorLimit: number;
  /** Total height of the terrain including bedrock. */
  readonly totalHeight: number;
  readonly unitsPerMeter: number;

  /** Later deposits have harder ground (see data/deposits.ts). */
  hardnessMult = 1;
  private readonly floors: Float32Array;
  private readonly columnWidth: number;
  private deepest: number;
  private focus: number;
  private deepestLayer = 0;
  private swings = 0;

  constructor(
    world: WorldConfig,
    readonly layers: readonly LayerDef[],
    private readonly onLayerEntered: (layerIndex: number) => void,
  ) {
    this.width = world.width;
    this.surfaceY = world.surfaceY;
    this.unitsPerMeter = world.unitsPerMeter;
    this.columnWidth = world.columnWidth;
    let y = world.surfaceY;
    layers.forEach((layer, index) => {
      this.bands.push({ index, layer, top: y, bottom: y + layer.thickness });
      y += layer.thickness;
    });
    this.floorLimit = y;
    this.totalHeight = y + world.bedrockHeight;
    this.floors = new Float32Array(Math.ceil(world.width / world.columnWidth) + 1).fill(world.surfaceY);
    this.deepest = world.surfaceY;
    this.focus = world.surfaceY;
  }

  // ---------- queries ----------

  /** Layer index at field y (clamped to the first / last layer). */
  layerIndexAtY(y: number): number {
    const last = this.bands.length - 1;
    for (let i = 0; i < last; i++) if (y < this.bands[i].bottom) return i;
    return last;
  }

  floorAt(x: number): number {
    const f = Math.max(0, Math.min(this.width, x)) / this.columnWidth;
    const i = Math.floor(f);
    const a = this.floors[i];
    const b = this.floors[Math.min(this.floors.length - 1, i + 1)];
    return a + (b - a) * (f - i);
  }

  /** The deepest point dug has reached bedrock. */
  get atBottom(): boolean {
    return this.deepest >= this.floorLimit - 0.5;
  }

  /** A fresh deposit: the ground is whole again. */
  reset(): void {
    this.floors.fill(this.surfaceY);
    this.deepest = this.surfaceY;
    this.focus = this.surfaceY;
    this.deepestLayer = 0;
    this.swings = 0;
  }

  isBottom(x: number): boolean {
    return this.floorAt(x) >= this.floorLimit - 0.5;
  }

  /** Layer of the ground the next swing at x would strike. */
  layerAt(x: number): LayerDef {
    return this.layers[this.layerIndexAtY(this.floorAt(x) + 1)];
  }

  /** Depth below the grass line of the deepest point dug so far, in field units. */
  get deepestUnits(): number {
    return this.deepest - this.surfaceY;
  }

  /** Depth below the grass line where the digger last struck. */
  get focusUnits(): number {
    return this.focus - this.surfaceY;
  }

  get totalDepthUnits(): number {
    return this.floorLimit - this.surfaceY;
  }

  get deepestMeters(): number {
    return this.deepestUnits / this.unitsPerMeter;
  }

  get focusMeters(): number {
    return this.focusUnits / this.unitsPerMeter;
  }

  get totalMeters(): number {
    return this.totalDepthUnits / this.unitsPerMeter;
  }

  /** 0..1 progress through the whole deposit. */
  get progress(): number {
    return this.deepestUnits / this.totalDepthUnits;
  }

  /** Index of the deepest layer entered so far. */
  get deepestLayerIndex(): number {
    return this.deepestLayer;
  }

  get focusLayerIndex(): number {
    return this.layerIndexAtY(this.focus + 1);
  }

  // ---------- digging ----------

  /**
   * One swing of a tool at column x: removes the tool's own shape of ground from the exposed floor.
   * The first part of the shape is the main bite and always reaches the full swing depth in the aimed
   * column, so a different shape changes how the hole looks and how wide it is, never how fast the shaft goes down.
   */
  dig(x: number, tool: ToolDef, boost: DigBoost = NO_BOOST): DigResult {
    const cw = this.columnWidth;
    // The main bite sits on a column centre, so a narrow tool still takes its full depth in that column.
    const cx = Math.max(0, Math.min(this.width, Math.round(x / cw) * cw));
    const floorBefore = this.floorAt(cx);
    const layerIndex = this.layerIndexAtY(floorBefore + 1);
    const layer = this.layers[layerIndex];
    // A tool that is too weak for the ground falls off steeply (a soft wall), so each layer wants a better tool.
    const efficiency = Math.max(tool.minEfficiency, Math.pow(Math.min(1, tool.power / (layer.hardness * this.hardnessMult)), EFFICIENCY_CURVE));
    const step = Math.min(tool.digDepth * boost.depth * efficiency, this.floorLimit - floorBefore);
    const radius = tool.craterRadius * boost.width * (0.78 + 0.22 * efficiency);
    const side = this.swings++ % 2 === 0 ? 1 : -1;
    this.focus = floorBefore;
    const parts: CraterPart[] = [];
    tool.shape.parts.forEach((p, i) => {
      const sway = p.wobble ? (Math.random() * 2 - 1) * p.wobble * radius : 0;
      const px = Math.max(0, Math.min(this.width, cx + p.dx * radius * (p.alt ? side : 1) + sway));
      const local = i === 0 ? floorBefore : this.floorAt(px);
      const bottom = Math.min(local + step * p.depth, this.floorLimit);
      const rx = Math.max(6, radius * p.rx);
      const ry = Math.max((bottom - local) * 1.45, rx * 0.5);
      parts.push({ cx: px, cy: bottom - ry, rx, ry, profile: p.profile });
    });
    const dug = step > 0.05;
    // Every part is measured against the ground as it was before the swing, then all are carved.
    if (dug) for (const p of parts) this.carve(p.cx, p.cy, p.rx, p.ry, p.profile);
    const main = parts[0];
    return {
      dug,
      layerIndex,
      layer,
      efficiency,
      floorBefore,
      floorAfter: this.floorAt(cx),
      cx: main.cx, cy: main.cy, rx: main.rx, ry: main.ry,
      parts,
    };
  }

  /**
   * A projectile's hole (Scrap Shot): a small round pocket dug into the bottom of the hole at aimX, `offset` field
   * units to the side. It reaches `depth` below the bottom of the main hole, so every shot helps the shaft down.
   */
  miniHole(aimX: number, offset: number, depth: number, width: number): CraterPart {
    const cx = Math.max(0, Math.min(this.width, aimX + offset));
    const bottom = Math.min(this.floorAt(aimX) + depth, this.floorLimit);
    const rx = Math.max(8, width);
    const ry = Math.max((bottom - this.floorAt(aimX)) * 1.45, rx * 0.5);
    const part: CraterPart = { cx, cy: bottom - ry, rx, ry, profile: 'round' };
    this.carve(part.cx, part.cy, part.rx, part.ry, part.profile);
    return part;
  }

  /** A pocket around a rock or a find: always round. */
  carveEllipse(cx: number, cy: number, rx: number, ry: number): void {
    this.carve(cx, cy, rx, ry, 'round');
  }

  /**
   * Removes a pocket of the given outline. A column's floor drops only where the pocket
   * reaches the exposed surface; pockets cut into a wall stay purely visual.
   */
  carve(cx: number, cy: number, rx: number, ry: number, profile: Profile): void {
    const cw = this.columnWidth;
    const first = Math.max(0, Math.floor((cx - rx) / cw));
    const last = Math.min(this.floors.length - 1, Math.ceil((cx + rx) / cw));
    for (let c = first; c <= last; c++) {
      const dx = (c * cw - cx) / rx;
      if (dx < -1 || dx > 1) continue;
      const half = ry * profileHalf(profile, dx);
      const bottom = Math.min(cy + half, this.floorLimit);
      if (this.floors[c] >= cy - half - 1 && bottom > this.floors[c]) {
        this.floors[c] = bottom;
        if (bottom > this.deepest) this.deepest = bottom;
      }
    }
    const layer = this.layerIndexAtY(this.deepest);
    if (layer > this.deepestLayer) {
      this.deepestLayer = layer;
      this.onLayerEntered(layer);
    }
  }
}
