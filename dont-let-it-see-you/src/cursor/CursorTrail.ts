import { CURSOR } from '../core/Tuning';

export interface TrailPoint {
  x: number;
  y: number;
  /** 1 at birth, 0 when it should vanish. */
  life: number;
  /** Agitation at the moment it was laid down, which tints the trail. */
  heat: number;
}

/**
 * The visible residue of recent attention.
 *
 * It is not only decoration: it is the player's read on the trail that advanced
 * enemies are also reading, so it has to be honest about where attention has been.
 */
export class CursorTrail {
  private readonly points: TrailPoint[] = [];
  private readonly pool: TrailPoint[] = [];
  private spawnTimer = 0;
  private lastX = 0;
  private lastY = 0;

  private static readonly FADE = 1 / 0.62;
  private static readonly MIN_SPACING = 4;
  private static readonly MAX_POINTS = 64;

  reset(x: number, y: number): void {
    for (const p of this.points) this.pool.push(p);
    this.points.length = 0;
    this.lastX = x;
    this.lastY = y;
    this.spawnTimer = 0;
  }

  update(dt: number, x: number, y: number, heat: number): void {
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      p.life -= dt * CursorTrail.FADE;
      if (p.life <= 0) {
        this.points.splice(i, 1);
        this.pool.push(p);
      }
    }

    this.spawnTimer += dt;
    const moved = Math.hypot(x - this.lastX, y - this.lastY);
    if (moved >= CursorTrail.MIN_SPACING || (this.spawnTimer > 0.07 && moved > 0.6)) {
      this.spawnTimer = 0;
      this.lastX = x;
      this.lastY = y;
      const p = this.pool.pop() ?? { x: 0, y: 0, life: 0, heat: 0 };
      p.x = x;
      p.y = y;
      p.life = 1;
      p.heat = heat;
      this.points.push(p);
      if (this.points.length > CursorTrail.MAX_POINTS) {
        this.pool.push(this.points.shift()!);
      }
    }
  }

  get all(): readonly TrailPoint[] {
    return this.points;
  }

  /** Used by the debug overlay to show the window enemies can read. */
  get capacity(): number {
    return CURSOR.historySamples;
  }
}
