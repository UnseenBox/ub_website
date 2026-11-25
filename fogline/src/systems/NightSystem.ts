import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { FIELD, VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { groundAt, project } from '../game/perspective';

interface Flare {
  x: number;
  z: number;
  life: number;
  img: Phaser.GameObjects.Image;
}

/** Seconds a flare burns, and how far it lights (metres). */
const FLARE_LIFE = 12;
const FLARE_RADIUS_M = 13;
/** Radius of the light that follows the sights, in pixels. */
const SIGHT_LIGHT = 175;

/**
 * Night missions: the field is dark except for a light that follows the sights,
 * flares the player fires over the field (Q), burning barrels and muzzle flashes.
 */
export class NightSystem {
  private readonly dark: Phaser.GameObjects.RenderTexture;
  /** Storm: rain over the field and lightning every few seconds. */
  private readonly rain: Phaser.GameObjects.TileSprite | null = null;
  private boltIn = 4;
  private boltLeft = 0;
  private readonly brush: Phaser.GameObjects.Image;
  private readonly flares: Flare[] = [];
  private flashLeft = 0;
  flaresLeft = 3;
  static readonly MAX_FLARES = 5;

  constructor(private readonly scene: Phaser.Scene, private readonly barrel: { x: number; y: number }, private readonly storm = false) {
    // Over the field and the sandbags, under the bunker frame, gun and HUD.
    this.dark = scene.add.renderTexture(0, 0, VIEW.width, VIEW.hudTop).setOrigin(0).setDepth(DEPTH.shutters + 5);
    this.brush = scene.make.image({ key: 'glow', add: false });
    if (storm) {
      this.rain = scene.add.tileSprite(0, 0, VIEW.width, VIEW.hudTop, 'rain').setOrigin(0).setDepth(DEPTH.shutters + 7).setAlpha(0.55);
      this.boltIn = 3 + Math.random() * 3;
    }
  }

  /** Storm: lightning lights the whole field for a moment, then thunder rolls in. */
  private updateStorm(dt: number): void {
    if (!this.rain) return;
    this.rain.tilePositionX -= dt * 260;
    this.rain.tilePositionY -= dt * 1100;
    this.boltLeft = Math.max(0, this.boltLeft - dt);
    this.boltIn -= dt;
    if (this.boltIn <= 0) {
      this.boltIn = 5 + Math.random() * 6;
      this.boltLeft = 0.45;
      this.scene.cameras.main.flash(120, 220, 225, 255, false);
      this.scene.time.delayedCall(500 + Math.random() * 900, () => audio.play('explosion', { volume: 0.45, rate: 0.55 }));
    }
  }

  /** Fire a flare at a screen point over the field. Returns false when none are left. */
  fireFlare(px: number, py: number): boolean {
    if (this.flaresLeft <= 0) return false;
    this.flaresLeft--;
    const g = groundAt(px, Math.max(py, VIEW.horizonY + 4));
    const z = Phaser.Math.Clamp(g.z, 10, FIELD.spawnZ - 10);
    const x = (g.x * z) / Math.max(g.z, 0.001);
    const img = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.shutters + 6).setTint(0xffb0a0);
    this.flares.push({ x, z, life: FLARE_LIFE, img });
    audio.play('shutters_up', { volume: 0.35, rate: 1.8 });
    return true;
  }

  /** Muzzle flashes light the field for a moment. */
  muzzleFlash(): void {
    this.flashLeft = 0.07;
  }

  /** New wave: two more flares, up to the cap. */
  restock(): void {
    this.flaresLeft = Math.min(NightSystem.MAX_FLARES, this.flaresLeft + 2);
  }

  update(dt: number, sightX: number, sightY: number): void {
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    this.updateStorm(dt);
    const rt = this.dark;
    rt.clear();
    // A storm is dim rather than black, and a lightning bolt lights everything (flickering out).
    const bolt = this.boltLeft > 0.3 ? 0 : this.boltLeft > 0.2 ? 0.35 : this.boltLeft > 0.12 ? 0.1 : -1;
    const base = this.storm ? 0.62 : 0.9;
    rt.fill(0x03050c, bolt >= 0 ? bolt : this.flashLeft > 0 ? base * 0.6 : base);
    const light = (x: number, y: number, r: number, alpha = 1): void => {
      this.brush.setScale(r / 128).setAlpha(alpha);
      rt.erase(this.brush, x, y);
    };
    light(sightX, sightY, SIGHT_LIGHT);
    light(sightX, sightY, SIGHT_LIGHT * 0.6);
    light(this.barrel.x, this.barrel.y, 120, 0.8);
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.img.destroy();
        this.flares.splice(i, 1);
        continue;
      }
      const p = project(f.x, f.z);
      // The flare drifts down from the sky toward its spot, flickering.
      const fall = 1 - f.life / FLARE_LIFE;
      const y = p.sy - (14 - fall * 10) * p.ppm;
      const fade = Math.min(1, f.life / 1.5);
      const flicker = 0.85 + Math.random() * 0.15;
      f.img.setPosition(p.sx, y).setScale(0.12 * flicker).setAlpha(fade);
      light(p.sx, p.sy - 2 * p.ppm, FLARE_RADIUS_M * p.ppm * flicker, fade);
      light(p.sx, p.sy - 2 * p.ppm, FLARE_RADIUS_M * p.ppm * 0.6, fade);
    }
  }

  clear(): void {
    for (const f of this.flares) f.img.destroy();
    this.flares.length = 0;
    this.dark.destroy();
    this.rain?.destroy();
  }
}
