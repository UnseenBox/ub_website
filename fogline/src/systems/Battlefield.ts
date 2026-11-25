import Phaser from 'phaser';
import { LOCATIONS, LocationDef, LocationId } from '../data/locations';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { project, screenYOfGround } from '../game/perspective';
import { depthForZ } from '../entities/Zombie';

const FOG_BANDS = [
  { z: 75, alpha: 0.42, speed: 4 },
  { z: 52, alpha: 0.36, speed: -6 },
  { z: 34, alpha: 0.3, speed: 9 },
  { z: 21, alpha: 0.22, speed: -12 },
  { z: 13, alpha: 0.12, speed: 15 },
];

/** Multiplies two 0xRRGGBB colours channel by channel. */
function multiply(a: number, b: number): number {
  const ch = (s: number): number => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Builds the battlefield for a location: sky, clouds, ground, props, fog bands,
 * parapet, frame and grain. Props are placed in world space, scaled and
 * depth-sorted by distance.
 */
export class Battlefield {
  private clouds: Phaser.GameObjects.TileSprite;
  private fog: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private grain: Phaser.GameObjects.TileSprite;
  readonly shutters: Phaser.GameObjects.Image;
  private shutterY = 0;
  private shutterTarget = 0;
  readonly barrelFire: { x: number; y: number; s: number };
  readonly smokeSource: { x: number; y: number };
  readonly location: LocationDef;

  constructor(scene: Phaser.Scene, locationId: LocationId = 'farm') {
    const loc = (this.location = LOCATIONS[locationId]);
    scene.add.image(0, 0, 'backdrop').setOrigin(0).setDepth(DEPTH.backdrop).setTint(loc.skyTint);
    this.clouds = scene.add.tileSprite(0, 0, VIEW.width, 190, 'clouds').setOrigin(0).setDepth(DEPTH.clouds + 2).setAlpha(0.95).setTint(loc.skyTint);
    scene.add.image(0, VIEW.horizonY, 'ground').setOrigin(0).setDepth(DEPTH.ground).setTint(loc.groundTint);

    if (loc.river) this.paintRiver(scene, loc.river.near, loc.river.far);
    if (loc.crossRoadZ !== undefined) this.paintCrossRoad(scene, loc.crossRoadZ);

    for (const p of loc.props) {
      const pr = project(p.x, p.z);
      const tex = scene.textures.get(p.key).getSourceImage() as HTMLCanvasElement;
      const scale = (p.heightM * pr.ppm) / tex.height;
      const img = scene.add.image(pr.sx, pr.sy + 2 * scale, p.key).setOrigin(0.5, 1).setScale(scale).setDepth(depthForZ(p.z));
      if (p.flip) img.setFlipX(true);
      const fogK = Phaser.Math.Clamp((p.z - 10) / 80, 0, 1);
      const g = Math.round(255 - fogK * 110);
      img.setTint(multiply(Phaser.Display.Color.GetColor(g, g, Math.min(255, g + 4)), loc.groundTint));
      img.setAlpha(1 - fogK * 0.45);
    }
    const barrel = project(loc.barrel.x, loc.barrel.z);
    this.barrelFire = { x: barrel.sx, y: barrel.sy - 0.95 * barrel.ppm, s: barrel.ppm / 120 };
    this.smokeSource = { x: 240, y: VIEW.horizonY - 18 };

    for (const b of FOG_BANDS) {
      const bottom = screenYOfGround(b.z) + 8;
      const top = VIEW.horizonY - 34;
      const s = scene.add.tileSprite(0, top, VIEW.width, bottom - top, 'fog_tile').setOrigin(0).setDepth(depthForZ(b.z)).setAlpha(b.alpha).setTint(loc.fogTint);
      s.tileScaleY = (bottom - top) / 96;
      s.tilePositionX = Math.random() * 512;
      this.fog.push({ sprite: s, speed: b.speed });
    }

    scene.add.image(0, VIEW.wallTop - 26, 'parapet').setOrigin(0).setDepth(DEPTH.parapet);
    this.shutters = scene.add.image(0, VIEW.hudTop, 'shutters').setOrigin(0).setDepth(DEPTH.shutters);
    this.shutterY = this.shutterTarget = VIEW.hudTop + 10;
    scene.add.image(0, 0, 'frame').setOrigin(0).setDepth(DEPTH.frame);
    this.grain = scene.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'grain').setOrigin(0).setDepth(DEPTH.overlay - 1).setAlpha(0.045);
  }

  /** A river across the field, with the bridge deck running over it down the middle. */
  private paintRiver(scene: Phaser.Scene, near: number, far: number): void {
    const yNear = screenYOfGround(near);
    const yFar = screenYOfGround(far);
    const g = scene.add.graphics().setDepth(DEPTH.ground + 0.4);
    g.fillStyle(0x2c3a42, 0.92).fillRect(0, yFar, VIEW.width, yNear - yFar);
    g.fillStyle(0x8aa0aa, 0.18);
    for (let i = 0; i < 26; i++) {
      const y = yFar + Math.random() * (yNear - yFar);
      g.fillRect(Math.random() * VIEW.width, y, 30 + Math.random() * 80, 1);
    }
    // The deck over the water: the road, between the bridge rails.
    const deck = (z: number): number => (7 * VIEW.focal) / z;
    g.fillStyle(0x3a3c3e, 1);
    g.fillPoints([
      new Phaser.Math.Vector2(VIEW.centerX - deck(far), yFar), new Phaser.Math.Vector2(VIEW.centerX + deck(far), yFar),
      new Phaser.Math.Vector2(VIEW.centerX + deck(near), yNear), new Phaser.Math.Vector2(VIEW.centerX - deck(near), yNear),
    ], true);
  }

  /** An asphalt road crossing the field from side to side (the evacuation route). */
  private paintCrossRoad(scene: Phaser.Scene, z: number): void {
    const near = screenYOfGround(z - 2.6);
    const far = screenYOfGround(z + 2.6);
    const g = scene.add.graphics().setDepth(DEPTH.ground + 0.5);
    g.fillStyle(0x26282a, 0.88).fillRect(0, far, VIEW.width, near - far);
    g.fillStyle(0x000000, 0.25).fillRect(0, far, VIEW.width, 2);
    // dashed centre line
    const mid = screenYOfGround(z);
    g.fillStyle(0xc8b870, 0.55);
    for (let x = -20; x < VIEW.width; x += 70) g.fillRect(x, mid - 1, 36, 2);
  }

  /** Top edge of whatever is currently blocking shots at the bottom of the view. */
  get coverTop(): number {
    return Math.min(VIEW.wallTop, this.shutterY + 8);
  }

  raiseShutters(up: boolean): void {
    this.shutterTarget = up ? VIEW.hudTop - 150 : VIEW.hudTop + 10;
  }

  update(dt: number): void {
    this.clouds.tilePositionX += dt * 3.5;
    for (const f of this.fog) f.sprite.tilePositionX += dt * f.speed;
    this.grain.tilePositionX = Math.random() * 256;
    this.grain.tilePositionY = Math.random() * 256;
    const k = this.shutterTarget < this.shutterY ? 9 : 4;
    this.shutterY += (this.shutterTarget - this.shutterY) * Math.min(1, dt * k);
    this.shutters.setY(this.shutterY);
  }
}
