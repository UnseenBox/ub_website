import type { LayerDef } from '../data/layers';
import type { ToolDef } from '../data/tools';

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

export interface DigResult {
  /** The swing hit solid ground and carved a crater. */
  dug: boolean;
  layerIndex: number;
  layer: LayerDef;
  /** 0..1 - how well the tool bites into this ground. */
  efficiency: number;
  floorBefore: number;
  floorAfter: number;
  /** The carved ellipse, for the scene to paint with the same numbers. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
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

  private readonly floors: Float32Array;
  private readonly columnWidth: number;
  private deepest: number;
  private focus: number;
  private deepestLayer = 0;

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

  /** One swing of a tool at column x: removes a lens of ground from the exposed floor. */
  dig(x: number, tool: ToolDef): DigResult {
    const cx = Math.max(0, Math.min(this.width, x));
    const floorBefore = this.floorAt(cx);
    const layerIndex = this.layerIndexAtY(floorBefore + 1);
    const layer = this.layers[layerIndex];
    const efficiency = Math.max(tool.minEfficiency, Math.min(1, tool.power / layer.hardness));
    const step = Math.min(tool.digDepth * efficiency, this.floorLimit - floorBefore);
    const rx = tool.craterRadius * (0.78 + 0.22 * efficiency);
    const ry = Math.max(step * 1.45, rx * 0.5);
    const cy = floorBefore + step - ry;
    this.focus = floorBefore;
    if (step > 0.05) this.carveEllipse(cx, cy, rx, ry);
    return {
      dug: step > 0.05,
      layerIndex,
      layer,
      efficiency,
      floorBefore,
      floorAfter: this.floorAt(cx),
      cx, cy, rx, ry,
    };
  }

  /**
   * Removes an elliptical pocket. A column's floor drops only where the pocket
   * reaches the exposed surface; pockets cut into a wall stay purely visual.
   */
  carveEllipse(cx: number, cy: number, rx: number, ry: number): void {
    const cw = this.columnWidth;
    const first = Math.max(0, Math.floor((cx - rx) / cw));
    const last = Math.min(this.floors.length - 1, Math.ceil((cx + rx) / cw));
    for (let c = first; c <= last; c++) {
      const dx = (c * cw - cx) / rx;
      if (dx < -1 || dx > 1) continue;
      const half = ry * Math.sqrt(1 - dx * dx);
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
