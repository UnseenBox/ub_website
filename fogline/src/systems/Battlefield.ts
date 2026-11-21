import Phaser from 'phaser';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { project, screenYOfGround } from '../game/perspective';
import { depthForZ } from '../entities/Zombie';

interface PropPlacement { key: string; x: number; z: number; heightM: number; flip?: boolean; tint?: number }

/** Static props placed in world space; scaled and depth-sorted by distance. */
const PROPS: PropPlacement[] = [
  { key: 'tree_0', x: -40, z: 72, heightM: 9 },
  { key: 'tree_1', x: 34, z: 58, heightM: 8.5, flip: true },
  { key: 'tree_2', x: -24, z: 36, heightM: 7.5 },
  { key: 'tree_0', x: 26, z: 26, heightM: 7, flip: true },
  { key: 'tree_1', x: -58, z: 90, heightM: 10 },
  { key: 'tree_2', x: 52, z: 85, heightM: 9 },
  { key: 'tree_1', x: -17, z: 20, heightM: 6.5 },
  { key: 'pole', x: -9, z: 64, heightM: 9 },
  { key: 'pole', x: -9, z: 38, heightM: 9 },
  { key: 'pole', x: -9, z: 22, heightM: 9 },
  { key: 'car', x: 8.5, z: 24, heightM: 1.6 },
  { key: 'car', x: -14, z: 52, heightM: 1.6, flip: true },
  { key: 'barrier', x: -3.4, z: 30, heightM: 0.85 },
  { key: 'barrier', x: 3.6, z: 46, heightM: 0.85 },
  { key: 'hedgehog', x: -6.2, z: 12, heightM: 1.5 },
  { key: 'hedgehog', x: 5.4, z: 14.5, heightM: 1.5, flip: true },
  { key: 'hedgehog', x: -10.5, z: 17, heightM: 1.5 },
  { key: 'hedgehog', x: 11.5, z: 10, heightM: 1.5 },
  { key: 'barrel', x: -7.4, z: 8.5, heightM: 0.9 },
  { key: 'wire_coil', x: 0, z: 7.2, heightM: 0.9 },
];

const FOG_BANDS = [
  { z: 75, alpha: 0.42, speed: 4 },
  { z: 52, alpha: 0.36, speed: -6 },
  { z: 34, alpha: 0.3, speed: 9 },
  { z: 21, alpha: 0.22, speed: -12 },
  { z: 13, alpha: 0.12, speed: 15 },
];

/** Builds the fixed battlefield: sky, clouds, ground, props, fog bands, parapet, frame and grain. */
export class Battlefield {
  private clouds: Phaser.GameObjects.TileSprite;
  private fog: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private grain: Phaser.GameObjects.TileSprite;
  readonly shutters: Phaser.GameObjects.Image;
  private shutterY = 0;
  private shutterTarget = 0;
  readonly barrelFire: { x: number; y: number; s: number };
  readonly smokeSource: { x: number; y: number };

  constructor(scene: Phaser.Scene) {
    scene.add.image(0, 0, 'backdrop').setOrigin(0).setDepth(DEPTH.backdrop);
    this.clouds = scene.add.tileSprite(0, 0, VIEW.width, 190, 'clouds').setOrigin(0).setDepth(DEPTH.clouds + 2).setAlpha(0.95);
    scene.add.image(0, VIEW.horizonY, 'ground').setOrigin(0).setDepth(DEPTH.ground);

    for (const p of PROPS) {
      const pr = project(p.x, p.z);
      const tex = scene.textures.get(p.key).getSourceImage() as HTMLCanvasElement;
      const scale = (p.heightM * pr.ppm) / tex.height;
      const img = scene.add.image(pr.sx, pr.sy + 2 * scale, p.key).setOrigin(0.5, 1).setScale(scale).setDepth(depthForZ(p.z));
      if (p.flip) img.setFlipX(true);
      const fogK = Phaser.Math.Clamp((p.z - 10) / 80, 0, 1);
      const g = Math.round(255 - fogK * 110);
      img.setTint(Phaser.Display.Color.GetColor(g, g, Math.min(255, g + 4)));
      img.setAlpha(1 - fogK * 0.45);
    }
    const barrel = project(-7.4, 8.5);
    this.barrelFire = { x: barrel.sx, y: barrel.sy - 0.95 * barrel.ppm, s: barrel.ppm / 120 };
    this.smokeSource = { x: 240, y: VIEW.horizonY - 18 };

    for (const b of FOG_BANDS) {
      const bottom = screenYOfGround(b.z) + 8;
      const top = VIEW.horizonY - 34;
      const s = scene.add.tileSprite(0, top, VIEW.width, bottom - top, 'fog_tile').setOrigin(0).setDepth(depthForZ(b.z)).setAlpha(b.alpha);
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
