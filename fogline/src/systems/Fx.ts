import Phaser from 'phaser';
import { backdrop } from '../rendering/Margins';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { project } from '../game/perspective';
import { depthForZ } from '../entities/Zombie';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

const BANDS = [0.1, 0.17, 0.28, 0.45, 0.7, 1.05, 1.5];

/**
 * A particle effect authored at near-camera scale, instanced at fixed
 * perspective scale bands. A burst picks the closest band and explodes in
 * that emitter's local space, so speed, gravity and size all scale together
 * without disturbing particles already in flight.
 */
class EmitterSet {
  private emitters: { e: Emitter; s: number }[] = [];
  constructor(scene: Phaser.Scene, tex: string, cfg: EmitterConfig, depth: number) {
    for (const s of BANDS) {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth).setScale(s);
      this.emitters.push({ e, s });
    }
  }
  burst(x: number, y: number, scale: number, count: number): void {
    let best = this.emitters[0];
    let bd = Infinity;
    const ls = Math.log(Math.max(0.02, scale));
    for (const b of this.emitters) {
      const d = Math.abs(Math.log(b.s) - ls);
      if (d < bd) { bd = d; best = b; }
    }
    best.e.explode(count, x / best.s, y / best.s);
  }
}

interface Pooled<T> { obj: T; life: number; max: number }

/**
 * All transient visual feedback. Uses banded particle emitters and small
 * object pools so firing at 13 rounds/s allocates nothing.
 */
export class Fx {
  private readonly scene: Phaser.Scene;
  private blood: EmitterSet;
  private inkDrops: EmitterSet;
  private gore: EmitterSet;
  private mist: EmitterSet;
  private dust: EmitterSet;
  private dirt: EmitterSet;
  private sparks: EmitterSet;
  private smoke: EmitterSet;
  private fire: EmitterSet;
  private frost: EmitterSet;
  private debris: EmitterSet;
  private casings: Emitter;
  private tracers: Pooled<Phaser.GameObjects.Image>[] = [];
  private texts: Pooled<Phaser.GameObjects.Text>[] = [];
  private glows: Pooled<Phaser.GameObjects.Image>[] = [];
  private rings: Pooled<Phaser.GameObjects.Image>[] = [];
  private decals: Phaser.GameObjects.Image[] = [];
  private decalIdx = 0;
  readonly damageOverlay: Phaser.GameObjects.Rectangle;
  readonly flashOverlay: Phaser.GameObjects.Rectangle;
  private damageAlpha = 0;
  private flashAlpha = 0;
  private flashDecay = 2;

  constructor(scene: Phaser.Scene) {
    const mk = (tex: string, cfg: EmitterConfig) => new EmitterSet(scene, tex, cfg, DEPTH.worldFx);
    this.scene = scene;
    this.inkDrops = mk('dot', {
      speed: { min: 80, max: 240 }, angle: { min: 225, max: 315 }, gravityY: 540, lifespan: { min: 320, max: 620 },
      scale: { start: 0.9, end: 0.3 }, tint: [0x050404, 0x0e0b0a], alpha: { start: 1, end: 0.2 },
    });
    this.blood = mk('dot', {
      speed: { min: 60, max: 300 }, angle: { min: 195, max: 345 }, gravityY: 760, lifespan: { min: 260, max: 640 },
      scale: { start: 0.7, end: 0.25 }, tint: [0x5a0806, 0x7a120c, 0x3d0504], alpha: { start: 1, end: 0.6 },
    });
    this.gore = mk('chunk_0', {
      speed: { min: 90, max: 330 }, angle: { min: 205, max: 335 }, gravityY: 950, lifespan: { min: 400, max: 800 },
      scale: { min: 0.7, max: 1.3 }, rotate: { min: 0, max: 360 }, tint: [0x4a0806, 0x5d1410, 0x7a5a50],
    });
    this.mist = mk('smoke_0', {
      speed: { min: 10, max: 60 }, lifespan: 520, scale: { start: 0.35, end: 1.3 }, alpha: { start: 0.55, end: 0 }, tint: 0x6a0c0a,
    });
    this.dust = mk('smoke_1', {
      speed: { min: 10, max: 50 }, angle: { min: 230, max: 310 }, lifespan: { min: 500, max: 900 },
      scale: { start: 0.3, end: 0.9 }, alpha: { start: 0.65, end: 0 }, tint: 0x6d604a,
    });
    this.dirt = mk('chunk_1', {
      speed: { min: 60, max: 220 }, angle: { min: 230, max: 310 }, gravityY: 700, lifespan: { min: 300, max: 600 },
      scale: { min: 0.4, max: 0.8 }, rotate: { min: 0, max: 360 }, tint: [0x3a3022, 0x4a3e2c, 0x2a241a],
    });
    this.sparks = mk('dot', {
      speed: { min: 140, max: 460 }, lifespan: { min: 80, max: 220 }, scale: { start: 0.45, end: 0 },
      tint: [0xffe0a0, 0xffc060], blendMode: Phaser.BlendModes.ADD, gravityY: 400,
    });
    this.smoke = mk('smoke_0', {
      speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 }, lifespan: { min: 1400, max: 2600 },
      scale: { start: 0.9, end: 2.8 }, alpha: { start: 0.75, end: 0 }, tint: [0x2a2826, 0x3a3632, 0x1c1b1a], gravityY: -40,
    });
    this.fire = mk('dot', {
      speed: { min: 10, max: 60 }, angle: { min: 250, max: 290 }, lifespan: { min: 200, max: 420 },
      scale: { start: 1.6, end: 0.2 }, alpha: { start: 0.9, end: 0 }, tint: [0xffa040, 0xff6a20, 0xffd080],
      blendMode: Phaser.BlendModes.ADD, gravityY: -160,
    });
    this.frost = mk('dot', {
      speed: { min: 30, max: 120 }, lifespan: { min: 250, max: 500 }, scale: { start: 0.6, end: 0 },
      tint: [0xcff0ff, 0x9fd8ff], blendMode: Phaser.BlendModes.ADD,
    });
    this.debris = mk('chunk_1', {
      speed: { min: 200, max: 700 }, angle: { min: 200, max: 340 }, gravityY: 1100, lifespan: { min: 600, max: 1100 },
      scale: { min: 0.8, max: 2.2 }, rotate: { min: 0, max: 360 }, tint: [0x2a241a, 0x3a3022, 0x111111],
    });
    this.casings = scene.add.particles(0, 0, 'px', {
      emitting: false, speed: { min: 220, max: 320 }, angle: { min: 295, max: 330 }, gravityY: 1400, lifespan: 520,
      // Brass shells, sized so they read clearly at the game's scale (about 36×16 px).
      scaleX: 9, scaleY: 4, rotate: { min: 0, max: 360 }, tint: [0xc8a050, 0xb08a3c],
    }).setDepth(DEPTH.casings);

    for (let i = 0; i < 24; i++) {
      const t = scene.add.image(0, 0, 'tracer').setOrigin(1, 0.5).setDepth(DEPTH.tracer).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.tracers.push({ obj: t, life: 0, max: 0.06 });
    }
    for (let i = 0; i < 24; i++) {
      const t = scene.add.text(0, 0, '', {
        fontFamily: '"Saira Stencil One", sans-serif', fontSize: '22px', color: '#d8e0a0', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(DEPTH.floatText).setVisible(false);
      this.texts.push({ obj: t, life: 0, max: 1 });
    }
    for (let i = 0; i < 16; i++) {
      const g = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.worldFx).setVisible(false);
      this.glows.push({ obj: g, life: 0, max: 0.3 });
    }
    for (let i = 0; i < 6; i++) {
      const r = scene.add.image(0, 0, 'ring').setDepth(DEPTH.worldFx).setVisible(false);
      this.rings.push({ obj: r, life: 0, max: 0.5 });
    }
    for (let i = 0; i < 14; i++) {
      this.decals.push(scene.add.image(0, 0, 'scorch').setDepth(DEPTH.decals).setVisible(false));
    }
    this.damageOverlay = backdrop(scene, 0x9a0000).setDepth(DEPTH.overlay).setAlpha(0);
    this.flashOverlay = backdrop(scene, 0xffffff).setDepth(DEPTH.overlay + 1).setAlpha(0);
  }

  update(dt: number): void {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.obj.setAlpha(Math.max(0, t.life / t.max));
      if (t.life <= 0) t.obj.setVisible(false);
    }
    for (const t of this.texts) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const k = 1 - t.life / t.max;
      t.obj.y -= dt * 46;
      t.obj.setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      t.obj.setScale(k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, k - 0.12));
      if (t.life <= 0) t.obj.setVisible(false);
    }
    for (const g of this.glows) {
      if (g.life <= 0) continue;
      g.life -= dt;
      const k = 1 - g.life / g.max;
      const base = g.obj.getData('base') as number;
      g.obj.setScale(base * (0.6 + k * 0.8));
      g.obj.setAlpha(Math.max(0, 1 - k));
      if (g.life <= 0) g.obj.setVisible(false);
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - r.life / r.max;
      const base = r.obj.getData('base') as number;
      r.obj.setScale(base * (0.2 + k * 1.2), base * (0.2 + k * 1.2) * 0.28);
      r.obj.setAlpha(Math.max(0, 0.8 * (1 - k)));
      if (r.life <= 0) r.obj.setVisible(false);
    }
    this.damageAlpha = Math.max(0, this.damageAlpha - dt * 1.6);
    this.damageOverlay.setAlpha(this.damageAlpha);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * this.flashDecay);
    this.flashOverlay.setAlpha(this.flashAlpha);
  }

  tracer(x0: number, y0: number, x1: number, y1: number, width = 1, life = 0.06): void {
    const t = this.tracers.find((p) => p.life <= 0) ?? this.tracers[0];
    const len = Math.hypot(x1 - x0, y1 - y0);
    t.obj.setPosition(x1, y1).setRotation(Math.atan2(y1 - y0, x1 - x0)).setDisplaySize(len, 3 * width).setVisible(true).setAlpha(1);
    t.life = t.max = life;
  }

  floatText(x: number, y: number, text: string, color: string, size = 22): void {
    const t = this.texts.find((p) => p.life <= 0) ?? this.texts[0];
    t.obj.setText(text).setColor(color).setFontSize(size).setPosition(x, y).setVisible(true).setAlpha(1).setScale(0.6);
    t.life = t.max = 1.1;
  }

  glow(x: number, y: number, size: number, tint: number, life: number, depth: number = DEPTH.worldFx): void {
    const g = this.glows.find((p) => p.life <= 0) ?? this.glows[0];
    g.obj.setPosition(x, y).setTint(tint).setVisible(true).setDepth(depth).setData('base', size / 256);
    g.obj.setScale(size / 256);
    g.life = g.max = life;
  }

  bloodHit(x: number, y: number, scale: number, heavy = false): void {
    this.blood.burst(x, y, scale, heavy ? 22 : 10);
    this.mist.burst(x, y, scale, heavy ? 3 : 1);
  }

  headshotGore(x: number, y: number, scale: number): void {
    this.gore.burst(x, y, scale, 10);
    this.blood.burst(x, y, scale, 30);
    this.mist.burst(x, y, scale * 1.6, 4);
  }

  /**
   * Black ink welling up out of the ground where a zombie dies. A pool spreads across the
   * ground under its feet; a dark mass then rises from the same spot and swallows the body,
   * and fades. Droplets are thrown up as it rises.
   */
  blackSplash(x: number, groundY: number, scale: number, bodyW: number, bodyH: number): void {
    // Above the battlefield fog and the parapet, so the ink reads as dark; the wire still hides the feet.
    const depth = DEPTH.worldFx;
    const poolScale = (1.1 * bodyW) / 384;
    const pool = this.scene.add.image(x, groundY, 'ink_puddle').setDepth(depth - 1).setScale(0.3 * poolScale);
    this.scene.tweens.add({ targets: pool, scale: poolScale, duration: 90, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: pool, alpha: 0, duration: 220, delay: 150, onComplete: () => pool.destroy() });

    const massX = (1.1 * bodyW) / 384;
    const massY = (0.85 * bodyH) / 512;
    const mass = this.scene.add.image(x, groundY, 'ink_drip').setOrigin(0.5, 1).setDepth(depth + 1).setScale(0.7 * massX, 0.02 * massY);
    this.scene.tweens.add({ targets: mass, scaleX: massX, scaleY: massY, duration: 110, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: mass, alpha: 0, duration: 240, delay: 170, onComplete: () => mass.destroy() });

    this.inkDrops.burst(x, groundY - 0.3 * bodyH, scale, 14);
  }

  /** Blood fountain from a headless neck (called for a few frames). */
  neckSpurt(x: number, y: number, scale: number): void {
    this.blood.burst(x, y, scale * 0.7, 2);
  }

  groundImpact(x: number, y: number, scale: number): void {
    this.dust.burst(x, y, scale, 2);
    this.dirt.burst(x, y, scale, 5);
  }

  sandbagImpact(x: number, y: number): void {
    this.dust.burst(x, y, 0.9, 3);
    this.dirt.burst(x, y, 0.8, 6);
  }

  ricochet(x: number, y: number, scale: number): void {
    this.sparks.burst(x, y, scale, 9);
    this.glow(x, y, 50 * scale + 10, 0xffd090, 0.06);
  }

  burnTick(x: number, y: number, scale: number): void {
    this.fire.burst(x + (Math.random() - 0.5) * 60 * scale, y + (Math.random() - 0.5) * 70 * scale, scale, 1);
  }

  frostHit(x: number, y: number, scale: number): void {
    this.frost.burst(x, y, scale, 8);
  }

  ejectCasing(x: number, y: number): void {
    this.casings.explode(1, x, y);
  }

  /** Ground explosion at world coordinates. */
  explosion(x: number, z: number, radiusM: number): void {
    const p = project(x, z);
    const s = p.ppm;
    const depth = Math.max(depthForZ(z) + 2, DEPTH.worldFx);
    const scale = (radiusM * s) / 260;
    this.glow(p.sx, p.sy - radiusM * s * 0.3, radiusM * s * 2.4, 0xffd8a0, 0.22, depth);
    this.glow(p.sx, p.sy - radiusM * s * 0.25, radiusM * s * 1.6, 0xff7a2a, 0.45, depth);
    this.glow(p.sx, p.sy - radiusM * s * 0.6, radiusM * s * 1.1, 0xffa040, 0.55, depth);
    const r = this.rings.find((q) => q.life <= 0) ?? this.rings[0];
    r.obj.setPosition(p.sx, p.sy).setVisible(true).setTint(0xd8c8a0).setData('base', (radiusM * 2.6 * s) / 256);
    r.life = r.max = 0.45;
    this.smoke.burst(p.sx, p.sy - radiusM * s * 0.3, scale * 1.6, 10);
    this.debris.burst(p.sx, p.sy - 4, scale, 22);
    this.sparks.burst(p.sx, p.sy - radiusM * s * 0.3, scale * 1.4, 14);
    this.fire.burst(p.sx, p.sy - radiusM * s * 0.3, scale * 2, 10);
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.setPosition(p.sx, p.sy).setVisible(true).setAlpha(0.85);
    d.setDisplaySize(radiusM * 2.2 * s, radiusM * 2.2 * s * (VIEW.camHeight / z) * 1.4 + 4);
  }

  /** Rising smoke column (used by the nuke). */
  smokeColumn(x: number, y: number, scale: number, count: number): void {
    this.smoke.burst(x, y, scale, count);
  }

  fireBurst(x: number, y: number, scale: number, count: number): void {
    this.fire.burst(x, y, scale, count);
  }

  damageFlash(amount: number): void {
    this.damageAlpha = Math.min(0.38, this.damageAlpha + 0.08 + amount * 0.006);
  }

  whiteFlash(alpha: number, decayPerSec: number, color = 0xffffff): void {
    this.flashOverlay.setFillStyle(color, 1);
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
    this.flashDecay = decayPerSec;
  }
}
