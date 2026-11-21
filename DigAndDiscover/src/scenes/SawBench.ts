import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { ART_RES, rockKeys } from '../art/RockArt';
import { MACHINE, SAW_RADIUS } from '../art/TextureFactory';
import type { Rock } from '../core/types';

/** One machine's lifecycle. `empty -> placing -> ready -> cutting -> revealed -> selling -> empty`. */
export type BenchPhase = 'empty' | 'placing' | 'ready' | 'cutting' | 'revealed' | 'selling';

/** Position and visual size of one machine inside the workshop stage. */
export interface BenchView {
  x: number;
  bedY: number;
  /** 1 = the original single-machine look. Extra machines are scaled down. */
  scale: number;
}

/** Hooks the scene uses for shared particle emitters and floating labels. */
export interface BenchFx {
  dust(x: number, y: number, count: number): void;
  spark(x: number, y: number, count: number): void;
  glitter(x: number, y: number): void;
  lucky(bench: SawBench): void;
}

const RAY_COUNT = 12;
const BLADE_REST = -290;
const BLADE_END = -60;

/**
 * A single saw machine: its own blade, rock, two halves and glow rays.
 * The scene owns the shared buttons, card and particle pools; a bench owns
 * only its machine's objects and tweens so several can cut at the same time.
 */
export class SawBench {
  phase: BenchPhase = 'empty';
  rock: Rock | null = null;
  bladeTarget = 0;

  private view: BenchView = { x: 0, bedY: 0, scale: 1 };
  private bladeSpeed = 0;
  private cutting = false;
  private raysSpin = 0;
  private glitterTimer: Phaser.Time.TimerEvent | null = null;

  readonly root: Phaser.GameObjects.Container;
  private readonly machineShadow: Phaser.GameObjects.Image;
  private readonly machine: Phaser.GameObjects.Image;
  private readonly rays: Phaser.GameObjects.Container;
  private readonly rockImg: Phaser.GameObjects.Image;
  private readonly cutLine: Phaser.GameObjects.Rectangle;
  private readonly halves: Phaser.GameObjects.Image[] = [];
  private readonly rod: Phaser.GameObjects.Rectangle;
  private readonly blade: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene, readonly index: number, private readonly fx: BenchFx) {
    this.root = scene.add.container(0, 0);
    this.machineShadow = scene.add.image(0, 0, 'shadow');
    this.machine = scene.add.image(0, 0, 'machine').setOrigin(0.5, MACHINE.bedY / MACHINE.height);
    this.rays = scene.add.container(0, 0).setVisible(false);
    for (let i = 0; i < RAY_COUNT; i++) {
      this.rays.add(scene.add.image(0, 0, 'ray').setOrigin(0.5, 1).setRotation((i / RAY_COUNT) * Math.PI * 2).setBlendMode(Phaser.BlendModes.ADD));
    }
    this.rockImg = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.cutLine = scene.add.rectangle(0, 0, 5, 10, 0xfff3c4).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    for (let i = 0; i < 2; i++) this.halves.push(scene.add.image(0, 0, '__DEFAULT').setVisible(false));
    this.rod = scene.add.rectangle(0, 0, 14, 0, 0x8d99a6).setOrigin(0.5, 0).setStrokeStyle(2, 0x4f5763);
    this.blade = scene.add.image(0, 0, 'saw');
    this.root.add([this.machineShadow, this.machine, this.rays, this.rockImg, this.cutLine, ...this.halves, this.rod, this.blade]);
  }

  get x(): number { return this.view.x; }
  get viewScale(): number { return this.view.scale; }
  get bedY(): number { return this.view.bedY; }
  get scale(): number { return this.view.scale; }

  /** Applies a new position/scale (called on resize and when the upgrade level changes). */
  setView(view: BenchView): void {
    this.view = view;
    const { x, bedY, scale: s } = view;
    this.machineShadow.setPosition(x, bedY + 120 * s).setScale(3.6 * s, 1.4 * s);
    this.machine.setPosition(x, bedY).setScale(s / ART_RES);
    this.rays.setPosition(x, this.rockCenterY()).setScale(s);
    this.rod.setPosition(x, bedY + BLADE_REST * s).setSize(Math.max(4, 14 * s), 0);
    if (!this.cutting) this.blade.setPosition(x, bedY + BLADE_REST * s).setScale(s / ART_RES);
    if (this.phase !== 'placing' && this.rock) this.rockImg.setPosition(x, this.rockCenterY()).setScale(this.rockScale());
    if (this.phase === 'revealed' || this.phase === 'selling') this.placeHalves(false);
  }

  private bladeRestY(): number { return this.view.bedY + BLADE_REST * this.view.scale; }
  private bladeEndY(): number { return this.view.bedY + BLADE_END * this.view.scale; }

  private rockScale(): number {
    return (GAME_CONFIG.rock.workshopScale / ART_RES) * this.view.scale;
  }

  private rockRadius(): number {
    return this.rock ? GAME_CONFIG.rock.baseRadius * this.rock.size * GAME_CONFIG.rock.workshopScale * this.view.scale : 0;
  }

  rockCenterY(): number {
    const r = this.rockRadius() || GAME_CONFIG.rock.baseRadius * GAME_CONFIG.rock.workshopScale * this.view.scale;
    return this.view.bedY - r * (this.rock?.exterior.squash ?? 0.85) - 2 * this.view.scale;
  }

  private rockTop(): number {
    return this.rockCenterY() - this.rockRadius() * (this.rock?.exterior.squash ?? 0.85);
  }

  /** Per-frame animation: blade spin, rod length and sparks while cutting. */
  update(dt: number): void {
    const s = this.view.scale;
    this.bladeSpeed += (this.bladeTarget - this.bladeSpeed) * Math.min(1, dt / 220);
    if (this.bladeSpeed > 0.001) this.blade.rotation += this.bladeSpeed * dt * 0.03;
    this.rod.height = Math.max(0, this.blade.y - this.bladeRestY());
    if (this.cutting && this.rock) {
      this.rockImg.x = this.view.x + Phaser.Math.FloatBetween(-1.6, 1.6) * s;
      const contact = Math.min(this.blade.y + SAW_RADIUS * s, this.view.bedY - 4 * s);
      const top = this.rockTop();
      if (contact > top) {
        this.cutLine.setPosition(this.view.x, top).setSize(5 * s, contact - top).setVisible(true);
        this.fx.spark(this.view.x, contact, 2);
        if (Math.random() < 0.3) this.fx.dust(this.view.x, contact, 1);
      }
    }
    if (this.rays.visible) this.rays.rotation += this.raysSpin * dt;
  }

  /** Flies a bag rock to this machine. Resolves when it is resting on the bed. */
  async place(rock: Rock, from: { x: number; y: number }, iconScale: number): Promise<void> {
    this.rock = rock;
    this.phase = 'placing';
    const to = { x: this.view.x, y: this.rockCenterY() };
    const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 220 * this.view.scale };
    const startScale = iconScale;
    const endScale = this.rockScale();
    this.rockImg.setTexture(rockKeys(rock).outside).setPosition(from.x, from.y).setScale(startScale).setAngle(0).setAlpha(1).setVisible(true);
    await this.counter({
      from: 0, to: 1, duration: 460, ease: 'Sine.easeInOut',
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        const t = tw.getValue() ?? 0;
        const u = 1 - t;
        this.rockImg.setPosition(u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x, u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y);
        this.rockImg.setScale(Phaser.Math.Linear(startScale, endScale, t));
        this.rockImg.setAngle(-20 * u);
      },
    });
    this.fx.dust(to.x, this.view.bedY - 6 * this.view.scale, 6);
    this.tweens({ targets: this.machine, y: { from: this.view.bedY + 4 * this.view.scale, to: this.view.bedY }, duration: 200, ease: 'Bounce.easeOut' });
    this.scene.tweens.chain({
      targets: this.rockImg,
      tweens: [
        { scaleX: endScale * 1.18, scaleY: endScale * 0.84, duration: 80, ease: 'Quad.easeOut' },
        { scaleX: endScale, scaleY: endScale, duration: 300, ease: 'Elastic.easeOut', easeParams: [1.1, 0.45] },
      ],
    });
    this.phase = 'ready';
  }

  /** Sends the rock back to its bag slot so another can take its place. */
  async returnToSlot(to: { x: number; y: number }, iconScale: number): Promise<void> {
    this.phase = 'placing';
    this.stopGlitter();
    this.scene.tweens.killTweensOf(this.rockImg);
    await this.tweens({ targets: this.rockImg, x: to.x, y: to.y, scale: iconScale, alpha: 0, duration: 220, ease: 'Quad.easeIn' });
    this.rockImg.setVisible(false).setTexture('__DEFAULT').setAlpha(1);
    this.rock = null;
    this.phase = 'empty';
  }

  /** Lowers the spinning blade onto the rock. */
  async cutDown(): Promise<void> {
    this.phase = 'cutting';
    this.bladeTarget = 1;
    await this.tweens({ targets: this.blade, y: this.rockTop() - SAW_RADIUS * this.view.scale + 6 * this.view.scale, duration: 320, ease: 'Sine.easeIn' });
  }

  /** The actual cut: blade travels through the rock for the configured duration. */
  async cutThrough(): Promise<void> {
    this.cutting = true;
    await this.tweens({ targets: this.blade, y: this.bladeEndY(), duration: GAME_CONFIG.cutting.cutDurationMs, ease: 'Linear' });
    this.cutting = false;
    this.rockImg.x = this.view.x;
  }

  async cutUp(): Promise<void> {
    await this.tweens({ targets: this.blade, y: this.bladeRestY(), duration: 300, ease: 'Sine.easeOut' });
    this.bladeTarget = 0;
    this.rockImg.setAngle(0);
    this.cutLine.setVisible(false);
  }

  /** Small anticipation wobble before the inside is shown. */
  async wobble(): Promise<void> {
    await this.tweens({ targets: this.rockImg, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 1 });
    this.rockImg.setAngle(0);
  }

  /** Shows the cross-section, split halves and (for better rocks) the glow rays. */
  reveal(): void {
    const rock = this.rock;
    if (!rock) return;
    const inside = rockKeys(rock).inside;
    const cy = this.rockCenterY();
    this.rockImg.setVisible(false);
    this.cutLine.setVisible(false);
    this.halves.forEach((half, i) => {
      half.setTexture(inside).setFlipX(i === 1).setPosition(this.view.x, cy).setScale(this.rockScale()).setAngle(0).setAlpha(1).setVisible(true);
    });
    this.placeHalves(true);
    const tier = rock.rarity.tier;
    if (tier >= 2) {
      const tint = rock.rarity.color;
      this.rays.setVisible(true).setAlpha(0).setScale(0.3 * this.view.scale).setPosition(this.view.x, cy);
      this.rays.each((ray: Phaser.GameObjects.Image) => ray.setTint(tint));
      this.raysSpin = 0.0003 + tier * 0.0001;
      this.tweens({ targets: this.rays, alpha: 0.25 + tier * 0.08, scale: (0.85 + tier * 0.15) * this.view.scale, duration: 500, ease: 'Back.easeOut' });
    }
    if (tier >= 1) {
      const rate = 420 - tier * 80;
      this.stopGlitter();
      this.glitterTimer = this.scene.time.addEvent({
        delay: rate,
        loop: true,
        callback: () => {
          const r = this.rockRadius();
          for (const half of this.halves) {
            this.fx.glitter(half.x + Phaser.Math.FloatBetween(-0.6, 0.6) * r, half.y + Phaser.Math.FloatBetween(-0.5, 0.5) * r);
          }
        },
      });
    }
    this.phase = 'revealed';
  }

  /** Animates the revealed halves away and returns the machine to idle. */
  async sellOut(): Promise<void> {
    this.phase = 'selling';
    this.stopGlitter();
    this.scene.tweens.killTweensOf(this.rays);
    this.tweens({ targets: this.rays, alpha: 0, duration: 300, onComplete: () => this.rays.setVisible(false) });
    for (const half of this.halves) this.scene.tweens.killTweensOf(half);
    await this.tweens({
      targets: this.halves,
      scale: this.rockScale() * 0.2,
      alpha: 0,
      y: '-=60',
      duration: 320,
      ease: 'Back.easeIn',
    });
    for (const half of this.halves) half.setVisible(false).setTexture('__DEFAULT');
    this.rockImg.setTexture('__DEFAULT');
    this.rock = null;
    this.phase = 'empty';
  }

  /** Used when a lucky cut rerolls the cross-section: halves pick up the new texture. */
  refreshInside(): void {
    if (!this.rock) return;
    const inside = rockKeys(this.rock).inside;
    for (const half of this.halves) half.setTexture(inside);
    this.fx.lucky(this);
  }

  private placeHalves(animate: boolean): void {
    const r = this.rockRadius();
    const cy = this.rockCenterY() - 8 * this.view.scale;
    // Machines in a row (view scale < 1) keep their halves closer so neighbours don't overlap.
    const spread = r * (this.view.scale < 1 ? 0.72 : 1.08);
    this.halves.forEach((half, i) => {
      const dir = i === 0 ? -1 : 1;
      const target = { x: this.view.x + dir * spread, y: cy, angle: dir * 9 };
      if (!animate) {
        this.scene.tweens.killTweensOf(half);
        half.setPosition(target.x, target.y).setAngle(target.angle).setScale(this.rockScale());
        return;
      }
      const s = this.rockScale();
      this.tweens({ targets: half, x: target.x, y: target.y, angle: target.angle, duration: 420, ease: 'Back.easeOut', easeParams: [2] });
      this.scene.tweens.chain({
        targets: half,
        tweens: [
          { scaleX: s * 1.12, scaleY: s * 0.9, duration: 110 },
          { scaleX: s, scaleY: s, duration: 380, ease: 'Elastic.easeOut', easeParams: [1, 0.5] },
        ],
      });
      this.tweens({ targets: half, y: target.y - 6, delay: 500, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  private stopGlitter(): void {
    this.glitterTimer?.remove();
    this.glitterTimer = null;
  }

  /** Brings an interrupted animation back to a resting state. */
  recover(): void {
    if (this.phase === 'cutting') {
      this.cutting = false;
      this.bladeTarget = 0;
      this.blade.setPosition(this.view.x, this.bladeRestY());
      this.cutLine.setVisible(false);
      if (this.rock) {
        this.rockImg.setPosition(this.view.x, this.rockCenterY()).setScale(this.rockScale()).setAlpha(1);
        this.phase = 'ready';
      } else {
        this.phase = 'empty';
      }
    } else if (this.phase === 'placing' && this.rock) {
      this.rockImg.setPosition(this.view.x, this.rockCenterY()).setScale(this.rockScale()).setAlpha(1);
      this.phase = 'ready';
    }
  }

  /** Stops every animation owned by this machine (called on SLEEP/SHUTDOWN). */
  clear(): void {
    this.recover();
    this.stopGlitter();
    this.bladeTarget = 0;
    this.cutting = false;
    this.bladeSpeed = 0;
    this.scene.tweens.killTweensOf([this.machineShadow, this.machine, this.rays, this.rockImg, this.cutLine, ...this.halves, this.rod, this.blade]);
  }

  destroy(): void {
    this.clear();
    this.root.destroy(true);
  }

  private tweens(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.scene.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private counter(config: Phaser.Types.Tweens.NumberTweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.scene.tweens.addCounter({ ...config, onComplete: () => resolve() }));
  }
}
